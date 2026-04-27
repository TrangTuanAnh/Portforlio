---
title: "Git index v4 path compression — bytes ngầm bypass scanner"
date: "2026-04-26"
tags: [GIT, INTERNALS, SECURITY]
type: blog
description: "Khám phá .git/index — file nội bộ quan trọng nhất của Git — và cơ chế nén path ở version 4 vô tình tạo blind spot cho scanner kiểu grep."
---

# Git index v4 — file nội bộ Git và bytes ngầm bypass scanner

Mỗi lần chạy `git status` hay `git checkout`, Git đọc/ghi 1 file nhị phân nằm ở `.git/index`. Đây là **bảng danh mục** của Git: nó nói "thư mục làm việc hiện tại có những file nào, mỗi file map sang object hash bao nhiêu, mtime/inode/mode ra sao".

`.git/index` không phải file text. Nó cũng không phải kho object như `.git/objects/`. Nó nằm giữa — một index nhị phân tối ưu cho tốc độ. Và từ Git 1.8, nó có thêm **version 4** với một feature ít ai để ý: **path compression**.

Bài này giải thích cấu trúc index, vì sao cần v4, và một mặt phụ ít người để ý — nén path làm kém hiệu quả các scanner search-by-content kiểu `grep`.

## 1. `.git/index` để làm gì

Khi `git add file.py`, Git làm 2 việc:

1. **Tạo blob object** — đọc nội dung `file.py`, tính SHA-1, lưu thành `.git/objects/xx/yyyy...` (zlib-compressed).
2. **Cập nhật index** — ghi vào `.git/index` rằng "path `file.py` map sang blob hash đó, mode 100644, mtime X, size Y".

Khi commit, Git dựa vào index để tạo tree object, rồi commit object trỏ tới tree. Index chính là **staging area** mà ai cũng nghe nhưng ít người biết format thật của nó.

Khi `git checkout .`, Git đọc index, với mỗi entry: lấy blob theo hash trong index, ghi nội dung ra worktree path tương ứng. Đó là lý do index quan trọng — **nó quyết định worktree được dựng lại như thế nào**.

## 2. Cấu trúc index — header + entries + extensions

Format theo [git-scm.com/docs/index-format](https://git-scm.com/docs/index-format):

```
+----------------+
| HEADER         |
|  "DIRC" (4B)   |
|  version (4B)  |  <- 2, 3, hoặc 4
|  N entries (4B)|
+----------------+
| ENTRY 0        |
| ENTRY 1        |
| ...            |
| ENTRY N-1      |
+----------------+
| EXTENSIONS     |  (TREE cache, REUC, ...)
+----------------+
| SHA-1 trailer  |  (20B checksum của toàn bộ phía trên)
+----------------+
```

Mỗi entry trông như sau:

```
ctime sec | ctime nsec  (4 + 4 byte)
mtime sec | mtime nsec  (4 + 4 byte)
dev | ino                (4 + 4 byte)
mode                     (4 byte)  <- 0o100644, 0o100755, ...
uid | gid                (4 + 4 byte)
size                     (4 byte)
SHA-1 of blob            (20 byte)
flags                    (2 byte)
[v3+: extended flags     (2 byte)]
path                     (variable, NUL-terminated)
padding                  (NULs để align 8 byte)
```

Với version 2 và 3, `path` là **chuỗi đầy đủ** của file path, terminated bằng `\0`. Ví dụ entry cho `src/lib/util.py`:

```
... mode | uid | gid | size | sha20 | flags | "src/lib/util.py" | \0 | (pad)
```

## 3. Vì sao cần v4 — repo nhiều file, index phình to

Với repo lớn — Linux kernel, Chromium — số file có thể lên hàng trăm nghìn. Path lặp prefix dài: `src/lib/foo.py`, `src/lib/bar.py`, `src/lib/baz/qux.py`. Mỗi entry lưu nguyên path → index dễ chạm 50-100 MB. Đọc/ghi chậm.

Git 1.8 (2013) ra v4 với **path compression**. Ý tưởng đơn giản: với mỗi entry sau entry đầu tiên, không lưu path đầy đủ, mà lưu:

```
remove_len   (varint) — xoá bao nhiêu ký tự cuối của previous_path
suffix       (raw)    — phần đuôi nối thêm
\0
```

Ví dụ 3 entry liên tiếp:

| Path đầy đủ | remove_len | suffix |
|---|---|---|
| `src/lib/util.py` | 0 | `src/lib/util.py` |
| `src/lib/data.py` | 7 | `data.py` |
| `src/main.py` | 14 | `main.py` |

Entry 1 lưu path đầy đủ. Entry 2: từ `src/lib/util.py` xoá 7 ký tự cuối (`util.py`) còn `src/lib/`, nối thêm `data.py`. Entry 3: từ `src/lib/data.py` xoá 14 ký tự cuối (`/lib/data.py` — 13 char à? — thực ra varint encode chính xác, chi tiết tuỳ implement) nối `main.py`.

`remove_len` là **varint** (LEB128) — số nhỏ chỉ dùng 1 byte, số lớn dùng nhiều byte:

```
0  -> 0x00
1  -> 0x01
127 -> 0x7F
128 -> 0x80 0x01
```

Với repo nhiều file cùng prefix, nén này tiết kiệm cực kỳ tốt — thực tế giảm size index 2-4 lần.

## 4. Hexdump 1 entry v4 thật

Lấy ví dụ 2 path liên tiếp `.giZ` rồi `.git/hooks/post-checkout`. Trong v4 entry 2:

```
remove_len = 1                  (xoá 'Z' cuối path 1)
suffix     = "t/hooks/post-checkout"
terminator = \0
```

Bytes thực:

```
... metadata 62 byte ... 01 't/hooks/post-checkout' 00 ...
```

Để ý: bytes lưu trong file **không có substring `git`** trải dài. Path 1 chỉ có `.giZ`, path 2 chỉ có `t/hooks/post-checkout`. Nhưng khi Git đọc lại + ghép, kết quả là `.git/hooks/post-checkout`.

## 5. Mặt phụ về security — bypass content scanner

Đây là chỗ thú vị. Một số sanitizer/scanner làm việc theo kiểu:

```sh
grep -rlZ 'git' . | xargs -0 rm -f --     # xoá file có chữ 'git'
```

Mục tiêu: dọn các tài nguyên Git nhạy cảm (`.git/...`) trước khi expose. Nhưng:

- File `.git/index` ở v4 với 2 entry chiến thuật như trên — bytes thực **không có** chuỗi `git` liên tiếp. `grep 'git'` không match. File qua mặt scanner.
- Khi tool khác (vd `git-dumper` rồi `git checkout .`) đọc lại file này, Git ghép path đúng và sinh `.git/hooks/post-checkout` ra worktree → trigger code execution.

Đây không phải bug Git — Git làm đúng spec. Vấn đề là **scanner content-based assumption rằng path lưu trong index là raw**. V4 phá vỡ assumption đó.

Đây là idea cốt lõi của 1 web challenge B01lers CTF 2026 (clankers-market) — chi tiết exploit ở [github.com/TrangTuanAnh/B01lers-CTF-2026/clankers-market](https://github.com/TrangTuanAnh/B01lers-CTF-2026/tree/main/clankers-market), có viết riêng writeup.

Mình verify nhanh cũng dễ — viết file `.git/index` 2 entry như trên, `xxd` ra coi byte:

```bash
$ xxd .git/index | head -8
00000000: 4449 5243 0000 0004 0000 0002 0000 0000  DIRC............
...
00000040: 002e 6769 5a00 0000 ...                  ..giZ...
00000050: ... 0174 2f68 6f6f 6b73 2f70 6f73 742d   .t/hooks/post-
00000060: 6368 6563 6b6f 7574 00 ...                checkout.
```

Quan sát: byte `67 69 74` (`g`, `i`, `t`) **không xuất hiện liên tiếp ở bất kỳ vị trí nào**. Nhưng `git ls-files` đọc file này vẫn thấy đúng path `.git/hooks/post-checkout`.

## 6. Ngoài nén path — index còn ẩn gì

- **Git LFS**: pointer file thay cho nội dung lớn.
- **TREE cache extension**: cache cấu trúc tree để `git status` nhanh hơn.
- **fsmonitor extension**: list các file đã thay đổi từ filesystem watcher.
- **End-of-index marker (EOIE)**: chỉ điểm vị trí extension cuối cùng để parse partial.
- **sparse checkout flags**: skip-worktree bit để Git bỏ qua entry trong worktree.

Tất cả đều là phần extension đứng sau entries. Sanitizer chuyên về Git nên parse đúng từng version + extension thay vì xài grep.

## 7. Cách build 1 file `.git/index` v4 từ Python

Code minh hoạ — không dùng thư viện ngoài:

```python
import struct

def encode_varint(value):
    if value == 0: return b"\x00"
    out = bytearray()
    while value > 0:
        byte = value & 0x7F
        value >>= 7
        if value: byte |= 0x80
        out.append(byte)
    return bytes(out)

def compress_path(path, previous_path):
    common = 0
    for a, b in zip(path, previous_path):
        if a != b: break
        common += 1
    remove_len = len(previous_path) - common
    suffix = path[common:]
    return encode_varint(remove_len) + suffix + b"\x00"

def pack_entry(path, prev_path, sha_hex, size, mode):
    sha_raw = bytes.fromhex(sha_hex)
    flags = len(path)
    # ctime,mtime,dev,ino,mode,uid,gid,size,sha,flags
    header = struct.pack(
        ">LLLLLLLLLL20sH",
        0, 0, 0, 0, 0, 0, mode, 0, 0, size, sha_raw, flags
    )
    return header + compress_path(path, prev_path)

def build_index_v4(entries):
    """entries = [(path, sha_hex, size, mode), ...]"""
    data = bytearray()
    data += b"DIRC"
    data += struct.pack(">LL", 4, len(entries))
    prev = b""
    for path, sha, size, mode in entries:
        data += pack_entry(path, prev, sha, size, mode)
        prev = path
    return bytes(data)
```

Còn thiếu phần SHA-1 trailer + extensions để file index hoàn toàn hợp lệ với mọi tool, nhưng đủ để Git checkout đọc cơ bản.

## 8. Kết

Git tối ưu mọi byte trong file `.git/`. V4 path compression là một tối ưu cụ thể có ích cho repo lớn, và là một detail hay mà ít blog tiếng Việt đào sâu. Mặt khác — bất kỳ format binary có **nén** hay **encoding** đều tạo ra gap giữa "bytes trên đĩa" và "ý nghĩa logic", và security tool nào dựa trên grep raw bytes đều dễ bị vượt qua.

Lessons:

- File internal (`.git/index`, `.docx` zip, PDF stream, font tables, ...) là **format có cấu trúc**. Sanitizer cần parse, không grep.
- Khi viết code cho user upload file, cấm thẳng đường ghi vào thư mục có ý nghĩa với tool khác (`.git/`, `.svn/`, `WEB-INF/`, ...).
- `git checkout` trên repo do attacker control = gần với RCE qua hook.

### Tham khảo

- Git index format: <https://git-scm.com/docs/index-format>
- Git hooks: <https://git-scm.com/docs/githooks>
- Source code Git read-cache.c (parser index): <https://github.com/git/git/blob/master/read-cache.c>
