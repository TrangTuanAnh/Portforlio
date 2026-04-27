---
title: "Race condition trên filesystem"
date: "2026-04-27"
tags: [CONCURRENCY, LINUX, SECURITY]
type: blog
description: "Race không chỉ ở memory. Worker pool web app + filesystem chia sẻ là chỗ race kinh điển. Pattern thường gặp + fix bằng O_TMPFILE / atomic rename / flock."
---

# Race condition trên filesystem

Nói "race condition" thì hay nghĩ tới mutex, atomic, memory ordering — chuyện giữa thread cùng process. Có 1 loại race khác phổ biến không kém, ít được nhắc: **race trên filesystem giữa các process độc lập**.

Loại này xảy ra mọi ngày trong web app production: 4 worker uvicorn cùng cầm shared filesystem, mỗi worker xử lý 1 request, 2 request đến cùng lúc cùng đụng vào 1 path. Mutex Python không cứu được — phải atomic của OS.

## Vì sao web app multi-worker dễ race filesystem

Config quen thuộc:

```bash
uvicorn app:main --workers 4 --host 0.0.0.0 --port 8000
gunicorn app:main -w 8 -k uvicorn.workers.UvicornWorker
```

Mỗi worker là **process độc lập**. Share:

- Filesystem
- Database file (sqlite, files)
- Cache directory
- `/tmp`

Không share Python memory, không share lock, không share thread state. `threading.Lock()` ở 1 worker, worker khác không thấy.

Hệ quả: 2 request cùng thời điểm cùng tạo cùng 1 file ở cùng 1 path --> mỗi request ở 1 worker khác --> race.

## Pattern 1 — create-then-write

```python
def save_user_avatar(user_id, image_bytes):
    path = f"/var/avatars/{user_id}.jpg"
    if os.path.exists(path):
        os.remove(path)
    with open(path, 'wb') as f:
        f.write(image_bytes)
```

2 request cùng `user_id`:

```
T1: A: exists -> True
T2: B: exists -> True
T3: A: remove        ok
T4: B: remove        FileNotFoundError --> request B fail
T5: A: open + write
```

Hoặc:

```
T1: A: open(path, 'wb')
T2: B: open(path, 'wb')   <-- truncate file A vừa mở
T3: A: write(image_A)     <-- ghi vào file đã bị B truncate
T4: B: write(image_B)
```

Race kiểu này thường im lặng, không exception, "thỉnh thoảng avatar bị nhoè". Khó debug vì không reproduce trên dev (1 worker).

## Pattern 2 — directory-then-multiple-files

Hay gặp khi xử lý upload nhiều file:

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

`archive_id` không thực sự unique (ví dụ user control), 2 request cùng `archive_id`:

```
T1: A makedirs   ok
T2: B makedirs   exist_ok=True, ok
T3: A ghi file 'a.txt'
T4: B ghi file 'b.txt'
T5: A zip dir   <-- zip CHỨA CẢ a.txt VÀ b.txt
T6: A rmtree   ok
T7: B zip dir   FAIL, dir đã bị A xoá
T8: B rmtree   FAIL nốt
```

Output zip A chứa file của B, dù A không upload b.txt. Race **mix nội dung 2 user** --> leak data hoặc exploit. Đây là pattern cốt lõi của bài [`egg`](https://github.com/TrangTuanAnh/B01lers-CTF-2026/tree/main/egg) ở B01lers CTF 2026.

## Pattern 3 — DB exists rồi write file

```python
def create_resource(name, content):
    if db.exists(name):
        raise Conflict()
    path = f"/storage/{name}"
    with open(path, 'wb') as f:
        f.write(content)
    db.insert(name, path)
```

DB và filesystem là 2 hệ thống khác. `db.exists` là 1 row read, `open + write` là filesystem op, `db.insert` là DB write. Không atomic chéo:

```
T1: A: db.exists(name) -> False
T2: B: db.exists(name) -> False
T3: A: write file
T4: B: write file (overwrite A)
T5: A: db.insert  -> ok
T6: B: db.insert  -> KEY CONFLICT
```

DB row của A thắng, file trên đĩa của B. Resource giờ "thuộc về A" nhưng nội dung là B.

## Fix — `O_TMPFILE` + `linkat` (Linux only)

Linux 3.11+ có flag `O_TMPFILE` cho `open()` — tạo file tạm vô danh, sau đó `linkat()` để hiện ra với tên cuối. Atomic cấp syscall.

```python
import os

O_TMPFILE = 0o20200000   # check <linux/fs.h>

def write_atomic_linux(path, data):
    dir_path = os.path.dirname(path) or "."
    fd = os.open(dir_path, os.O_WRONLY | O_TMPFILE, 0o644)
    try:
        os.write(fd, data)
        os.link(f"/proc/self/fd/{fd}", path)
    finally:
        os.close(fd)
```

- Không có file tạm tên rác trong filesystem nếu process crash.
- `os.link` fail nếu path đã tồn tại --> create-only semantics.
- Truly atomic.

Nhược: chỉ Linux. Không portable.

## Fix — atomic rename (POSIX)

Portable hơn: ghi ra file tạm, fsync, rồi `os.rename` sang tên cuối. POSIX yêu cầu `rename` atomic trong cùng filesystem.

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
        os.rename(tmp, path)
    except:
        os.unlink(tmp)
        raise
```

- `tmp` và `path` phải **cùng filesystem**. Khác fs (vd `/tmp` vs `/data`) --> `rename` degrade thành copy + unlink, không atomic.
- `os.rename` overwrite path nếu tồn tại. Muốn create-only thì dùng `os.link` (POSIX) — fail nếu target tồn tại.

## Fix — file lock (`flock`)

Khi cần serialize 1 đoạn code giữa các process:

```python
import fcntl

def with_lock(lock_path, fn):
    with open(lock_path, 'w') as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)   # block đến khi có lock
        try:
            return fn()
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)
```

`flock` là **advisory** — chỉ work nếu mọi process tham gia tôn trọng lock. Process bypass `flock` vẫn ghi được.

Mỗi resource cần 1 lock file riêng, lock không tự xoá khi crash. Cẩn thận deadlock nếu 2 lock theo thứ tự khác nhau.

Alternative: `fcntl.lockf` (kernel-managed, range-based), `O_EXCL | O_CREAT` (atomic create-fail-if-exists, dùng làm marker file).

## Fix — đẩy state về DB transaction

Nếu race là "DB exists rồi write file", đôi khi cách sạch nhất là **không lưu trên filesystem**:

```python
def create_resource(name, content):
    with db.transaction():
        if db.exists(name):
            raise Conflict()
        db.insert(name, content)        # content trong cột BLOB
```

DB transaction lo serialization. Hết race. Filesystem không can dự.

Hoặc object storage (S3, MinIO) với conditional put (`If-None-Match: *`) — atomic create-or-fail ở storage backend.

## Verify — viết test reproduce race

```python
import concurrent.futures, requests

def attack(i):
    return requests.post("http://target/api", json={"name": "race-target", "data": f"req-{i}"})

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
    futures = [ex.submit(attack, i) for i in range(100)]
    for f in futures: print(f.result().status_code)
```

100 request song song với cùng `name`. Có race thì:

- Một số request thành công bất thường (nên fail vì conflict mà lại pass).
- File trên đĩa nội dung không khớp request nào.
- DB row count khác số request thành công.

Trong CTF, đây là cách standard để confirm race window có tồn tại.

## Tổng kết

| Pattern | Vấn đề | Fix |
|---|---|---|
| `if exists: remove; open; write` | TOCTOU + truncate race | `os.rename` từ tmp |
| `makedirs + write nhiều file + zip` | Mix nội dung | Mỗi req 1 dir UUID + atomic |
| `db.exists + write file + db.insert` | Cross-system race | DB transaction lo cả 2 |
| Cần exclusive section | Process race | `flock` hoặc `O_EXCL` |
| Cần create-or-fail | Atomic create | `os.link` từ `O_TMPFILE` |

Filesystem là shared mutable state. Race trên filesystem là race condition. Worker pool web app làm race filesystem dễ trigger hơn dev local 1 worker rất nhiều.

Default an toàn: **đừng dùng filesystem để lưu state shared giữa request**. Đẩy về DB hoặc object storage. Filesystem chỉ dùng cho cache (race ko sao, mất idempotent), log, hoặc sandbox 1 lần dùng.

### Tham khảo

- `man 2 open` — `O_TMPFILE`, `O_EXCL`
- `man 2 rename` — atomicity guarantees
- POSIX advisory locks: <https://pubs.opengroup.org/onlinepubs/9699919799/functions/fcntl.html>
