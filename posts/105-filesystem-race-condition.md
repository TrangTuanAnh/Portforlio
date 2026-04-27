---
title: "Race condition trên filesystem — không chỉ là memory"
date: "2026-04-27"
tags: [CONCURRENCY, LINUX, SECURITY]
type: blog
description: "Race condition không chỉ xảy ra giữa thread cùng process. Worker pool web app + filesystem chia sẻ là chỗ race kinh điển — và cách phòng tránh bằng O_TMPFILE, atomic rename, file lock."
---

# Race condition trên filesystem — không chỉ là memory

Khi nghe "race condition" mình thường nghĩ tới mutex, atomic, memory ordering — chuyện giữa thread trong cùng 1 process. Nhưng có một loại race khác phổ biến không kém, ít người nhắc đến: **race trên filesystem giữa các process độc lập**.

Đây là loại race xảy ra mọi ngày trong web app production: 4 worker uvicorn / 8 worker gunicorn cùng cầm shared filesystem, mỗi worker xử lý 1 request, và 2 request đến cùng lúc cùng đụng vào 1 path. Khi đó "atomic" của ngôn ngữ không cứu được — phải là atomic của OS.

Bài này nói về 3 pattern race filesystem thường gặp + 3 cách fix bằng primitive Linux/POSIX.

## 1. Vì sao web app multi-worker dễ race filesystem

Một config FastAPI/Flask production thường là:

```bash
uvicorn app:main --workers 4 --host 0.0.0.0 --port 8000
# hoặc
gunicorn app:main -w 8 -k uvicorn.workers.UvicornWorker
```

Mỗi worker là **một process độc lập** (không phải thread). Chúng share:

- Cùng filesystem
- Cùng database file (sqlite, files)
- Cùng cache directory
- Cùng `/tmp`

Nhưng **không share** Python memory, không share lock object, không share thread state. Anh tạo `threading.Lock()` ở 1 worker thì worker khác không thấy.

Hệ quả: nếu 2 request cùng thời điểm cùng tạo cùng 1 file ở cùng 1 path — mỗi request được 1 worker khác nhau bốc, **race nhau**. `with open(path, 'w')` không atomic về nội dung file, không atomic về sự tồn tại file. `os.makedirs(path)` không atomic về thư mục con.

## 2. Pattern 1 — Race "create-then-write"

Code điển hình:

```python
def save_user_avatar(user_id, image_bytes):
    path = f"/var/avatars/{user_id}.jpg"
    if os.path.exists(path):
        os.remove(path)
    with open(path, 'wb') as f:
        f.write(image_bytes)
```

Two requests cùng `user_id` xảy ra đồng thời:

```
T1: A: exists(...) -> True
T2: B: exists(...) -> True
T3: A: remove(...)  <- ok
T4: B: remove(...)  <- FileNotFoundError, request B fail
T5: A: open + write
```

Hoặc:

```
T1: A: open(path, 'wb')
T2: B: open(path, 'wb')   <- truncate file mà A vừa mở!
T3: A: write(image_A)     <- ghi vào file đã bị B truncate
T4: B: write(image_B)
T5: file cuối có thể là rác lai giữa A và B nếu OS cache lung tung
```

Loại race này thường im lặng — không exception, chỉ là "thỉnh thoảng avatar bị nhoè". Khó debug vì không reproduce được trên dev server (1 worker).

## 3. Pattern 2 — Race "directory-then-multiple-files"

Đây là pattern hay gặp khi xử lý upload nhiều file:

```python
def process_archive(archive_id, files):
    work_dir = f"/tmp/work/{archive_id}/"
    os.makedirs(work_dir, exist_ok=True)
    for name, content in files:
        with open(work_dir + name, 'wb') as f:
            f.write(content)
    zip_dir(work_dir, f"/tmp/out/{archive_id}.zip")
    shutil.rmtree(work_dir)
```

Nếu `archive_id` không thực sự unique (ví dụ user control), 2 request cùng `archive_id`:

```
T1: A makedirs   <- ok
T2: B makedirs   <- exist_ok=True, ok
T3: A ghi file 'a.txt'
T4: B ghi file 'b.txt'
T5: A zip dir   <- zip CHỨA CẢ a.txt VÀ b.txt
T6: A rmtree   <- ok
T7: B zip dir   <- FAIL, dir đã bị A xoá
T8: B rmtree   <- FAIL nốt
```

Output zip cuối cùng (của A) chứa file của B, dù A không hề upload b.txt. Đây là race **mix nội dung giữa 2 user** — leak data hoặc exploit.

(Đây là pattern cốt lõi của 1 challenge B01lers CTF 2026 — kẻ tấn công ép nội dung file của mình chui vào archive của victim.)

## 4. Pattern 3 — Race "check-then-act" với DB + file

Một pattern phức tạp hơn — kết hợp DB row với file trên disk:

```python
def create_resource(name, content):
    if db.exists(name):
        raise Conflict()
    path = f"/storage/{name}"
    with open(path, 'wb') as f:
        f.write(content)
    db.insert(name, path)
```

DB và filesystem là 2 hệ thống khác nhau. `db.exists` là 1 row read, `open + write` là filesystem op, `db.insert` là DB write. Không atomic chéo:

```
T1: A: db.exists(name) -> False
T2: B: db.exists(name) -> False
T3: A: write file
T4: B: write file (overwrite A)
T5: A: db.insert  -> ok
T6: B: db.insert  -> KEY CONFLICT (A đã insert)
```

DB row của A thắng nhưng file trên đĩa là của B. Resource giờ "thuộc về A" nhưng nội dung là B.

## 5. Cách fix — `O_TMPFILE` + `linkat` (Linux only)

Linux 3.11 có flag `O_TMPFILE` cho `open()` — tạo file tạm vô danh trong filesystem, sau đó `linkat()` để hiện ra với tên cuối cùng. Atomic ở mức filesystem syscall.

```python
import os
import ctypes

O_TMPFILE = 0o20200000  # depends on arch, check <linux/fs.h>

def write_atomic_linux(path, data):
    dir_path = os.path.dirname(path) or "."
    fd = os.open(dir_path, os.O_WRONLY | O_TMPFILE, 0o644)
    try:
        os.write(fd, data)
        # link file ẩn ra tên cuối — atomic
        os.link(f"/proc/self/fd/{fd}", path)
    finally:
        os.close(fd)
```

Đặc điểm:

- Không có file tạm tên rác trong filesystem nếu process crash.
- `os.link` fail nếu path đã tồn tại — tự nhiên có "create-only" semantics.
- Truly atomic: không có khoảnh khắc nào file half-written hiện ra với tên cuối.

Nhược: chỉ Linux có. Không portable sang macOS/Windows.

## 6. Cách fix — atomic rename (POSIX)

Portable hơn: ghi ra file tạm tên random, fsync, rồi `os.rename` sang tên cuối. POSIX yêu cầu `rename` atomic trong cùng filesystem.

```python
import os, tempfile

def write_atomic(path, data):
    dir_path = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=dir_path)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.rename(tmp, path)   # atomic
    except:
        os.unlink(tmp)
        raise
```

Quan trọng: tmp và path **phải cùng filesystem** (dùng `dir=os.path.dirname(path)` để đảm bảo). Nếu khác fs (vd `/tmp` vs `/data`), `rename` sẽ degrade thành copy + unlink — không atomic nữa.

`os.rename` overwrite path nếu tồn tại. Muốn "create-only" semantics thì dùng `os.link` (POSIX) — fail nếu target tồn tại.

## 7. Cách fix — file lock (`flock`)

Khi cần serialize 1 đoạn code giữa các process, dùng `fcntl.flock`:

```python
import fcntl

def with_lock(lock_path, fn):
    with open(lock_path, 'w') as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)   # block tới khi có lock
        try:
            return fn()
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

def create_resource(name, content):
    with_lock(f"/var/lock/resource_{name}.lock",
              lambda: _create_resource_unsafe(name, content))
```

`flock` là **advisory** — chỉ work nếu mọi process tham gia cùng tôn trọng lock. Process bypass `flock` vẫn ghi được.

Nhược: mỗi resource cần 1 lock file riêng, lock không tự xoá khi crash. Cẩn thận deadlock nếu 2 lock theo thứ tự khác nhau.

Alternative: `fcntl.lockf` (kernel-managed, range-based lock), `O_EXCL | O_CREAT` (atomic create-fail-if-exists, dùng làm marker file).

## 8. Cách fix — đẩy state về DB transaction

Nếu race là "DB exists rồi write file" pattern, đôi khi cách sạch nhất là **không lưu trên filesystem** — đẩy data vào DB blob/object storage có transaction:

```python
def create_resource(name, content):
    with db.transaction():
        if db.exists(name):
            raise Conflict()
        db.insert(name, content)   # content trong cột BLOB
```

DB transaction lo phần serialization. Hết race. Filesystem không can dự.

Hoặc dùng object storage (S3, MinIO) với conditional put (`If-None-Match: *`) — atomic create-or-fail ở cấp storage backend.

## 9. Verify — viết test reproduce race

Race khó reproduce trên dev server. Cách verify:

```python
import concurrent.futures
import requests

def attack(i):
    return requests.post("http://target/api", json={"name": "race-target", "data": f"req-{i}"})

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
    futures = [ex.submit(attack, i) for i in range(100)]
    for f in futures: print(f.result().status_code)
```

Bắn 100 request song song với cùng `name`. Nếu code có race, thường sẽ thấy:

- Một số request thành công bất thường (nên fail vì conflict mà lại pass).
- File trên đĩa có nội dung không khớp bất kỳ request nào.
- DB row count khác số request thành công.

Trong CTF, đây là cách standard để confirm có race window.

## 10. Tóm tắt

| Pattern | Vấn đề | Fix |
|---|---|---|
| `if exists: remove; open: write` | TOCTOU + truncate race | `os.rename` từ tmp |
| `makedirs + write nhiều file + zip` | Mix nội dung | Mỗi req 1 dir UUID + atomic |
| `db.exists + write file + db.insert` | Cross-system race | DB transaction lo cả 2 |
| Cần exclusive section | Process race | `flock` hoặc `O_EXCL` |
| Cần create-or-fail file | Atomic create | `os.link` từ `O_TMPFILE` |

Bottom line: **filesystem là shared mutable state**. Race condition trên filesystem là một dạng race condition. Worker pool web app làm cho race filesystem dễ trigger hơn nhiều so với dev local 1 worker. Cứ chỗ nào code có "check rồi act" trên filesystem là phải nghĩ tới chuyện 2 worker cùng làm vào lúc đó.

Default an toàn: **đừng dùng filesystem để lưu state shared giữa request**. Đẩy về DB hoặc object storage. Filesystem chỉ dùng cho cache (race ko sao, mất idempotent), log, hoặc sandbox 1 lần dùng (xoá ngay sau request).

### Tham khảo

- `man 2 open` — flag `O_TMPFILE`, `O_EXCL`
- `man 2 rename` — atomicity guarantees
- POSIX advisory locks: <https://pubs.opengroup.org/onlinepubs/9699919799/functions/fcntl.html>
