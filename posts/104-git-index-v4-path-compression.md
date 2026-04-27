---
title: "Git index v4 path compression"
date: "2026-04-26"
tags: [GIT, INTERNALS, SECURITY]
type: blog
description: "Cấu trúc .git/index, vì sao v4 nén path, và mặt phụ — bytes thực không trùng với path logic, phá `grep` scanner."
---

# Git index v4 path compression

Mỗi lần `git status` hay `git checkout`, Git đọc/ghi 1 file nhị phân: `.git/index`. Đây là **bảng danh mục** của Git — path nào map sang object hash nào, mode/mtime/inode ra sao.

Index không phải text, không phải kho object. Nó nằm giữa, format binary tối ưu cho tốc độ. Từ Git 1.8 (2013), có version 4 với feature ít người để ý: **path compression**.

## Index làm gì

Khi `git add file.py`:

1. Tạo blob — đọc nội dung, tính SHA-1, lưu thành `.git/objects/xx/yyyy...` (zlib-compressed).
2. Update index — ghi entry "path `file.py` map sang blob hash đó, mode 100644, ...".

Commit dựa vào index sinh tree object, rồi commit object trỏ tree. Index = staging area.

`git checkout .` đọc index, mỗi entry: lấy blob theo hash → ghi nội dung ra worktree. **Index quyết định worktree được dựng lại ra sao.**

## Cấu trúc

```
+----------------+
| HEADER         |
|  "DIRC" (4B)   |
|  version (4B)  |    <- 2, 3, hoặc 4
|  N entries (4B)|
+----------------+
| ENTRY 0        |
| ENTRY 1        |
| ...            |
+----------------+
| EXTENSIONS     |    (TREE cache, REUC, ...)
+----------------+
| SHA-1 trailer  |    (20B checksum toàn bộ phía trên)
+----------------+
```

Mỗi entry:

```
ctime sec | ctime nsec  (4 + 4 byte)
mtime sec | mtime nsec  (4 + 4 byte)
dev | ino                (4 + 4 byte)
mode                     (4 byte)    <- 0o100644, 0o100755, ...
uid | gid                (4 + 4 byte)
size                     (4 byte)
SHA-1 of blob            (20 byte)
flags                    (2 byte)
[v3+: extended flags     (2 byte)]
path                     (variable, NUL-terminated)
padding                  (NULs để align 8 byte)
```

V2/v3: `path` là chuỗi đầy đủ, terminated `\0`. Repo Linux kernel hay Chromium có hàng trăm nghìn file, lặp prefix `src/lib/...` nhiều, nên index dễ chạm 50-100 MB.

## V4 — path compression

V4 không lưu path đầy đủ cho entry sau entry đầu. Thay vào đó:

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
| `src/main.py` | 12 | `main.py` |

`remove_len` là varint LEB128 — số nhỏ 1 byte, lớn nhiều byte:

```
0   -> 0x00
1   -> 0x01
127 -> 0x7F
128 -> 0x80 0x01
```

Repo nhiều file cùng prefix --> index nhỏ hơn 2-4 lần.

## Hexdump 1 entry v4

2 path liên tiếp `.giZ` rồi `.git/hooks/post-checkout`. Entry 2:

```
remove_len = 1                 (xoá 'Z' của path 1)
suffix     = "t/hooks/post-checkout"
terminator = \0
```

Bytes thực:

```
... metadata 62 byte ... 01 't/hooks/post-checkout' 00 ...
```

Bytes lưu **không có** chuỗi `git` trải dài ở bất kỳ vị trí nào. Path 1 chỉ có `.giZ`, path 2 chỉ có `t/hooks/post-checkout`. Khi Git đọc lại + ghép: `.giZ`[:3] + `t/hooks/post-checkout` = `.git/hooks/post-checkout`. Git hiểu đúng.

## Mặt phụ — bypass content scanner

Pattern sanitizer thường gặp:

```sh
grep -rlZ 'git' . | xargs -0 rm -f --     # xoá file có chứa 'git'
```

Mục tiêu: dọn `.git/...` nhạy cảm trước khi expose. Nhưng:

- File `.git/index` v4 với 2 entry kiểu trên — bytes thực không có `git` liên tiếp --> `grep` không match --> file qua mặt scanner.
- Tool sau (vd `git-dumper` rồi `git checkout .`) đọc lại file này --> Git ghép path đúng --> sinh `.git/hooks/post-checkout` ra worktree --> Git auto-run hook --> code execution.

Không phải bug Git — Git làm đúng spec. Vấn đề là **scanner content-based assumption rằng path lưu trong index là raw**. V4 phá assumption đó.

Đây là idea chính của bài [`clankers-market`](https://github.com/TrangTuanAnh/B01lers-CTF-2026/tree/main/clankers-market) ở B01lers CTF 2026.

## Build .git/index v4 từ Python

Code minh hoạ — không thư viện ngoài:

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

Code trên thiếu SHA-1 trailer + extensions để file fully valid với mọi tool, nhưng đủ để Git checkout đọc cơ bản.

## Ngoài nén path, index còn ẩn

- **TREE cache**: cache cấu trúc tree để `git status` nhanh.
- **fsmonitor**: list file đã thay đổi từ filesystem watcher.
- **End-of-index marker (EOIE)**: chỉ điểm vị trí extension cuối, parse partial.
- **sparse checkout flags**: skip-worktree bit để Git bỏ qua entry trong worktree.
- **Git LFS**: pointer file thay nội dung lớn.

Mọi thứ là extension đứng sau entries. Sanitizer chuyên về Git phải parse format từng version + extension thay vì grep raw.

## Lessons

- File internal (`.git/index`, docx zip, PDF stream, font tables) là **format có cấu trúc**. Sanitizer cần parse, không grep.
- Code cho user upload, cấm thẳng đường ghi vào thư mục có ý nghĩa với tool khác (`.git/`, `.svn/`, `WEB-INF/`, ...).
- `git checkout` trên repo do attacker control = gần với RCE qua hook.

### Tham khảo

- Git index format: <https://git-scm.com/docs/index-format>
- Git hooks: <https://git-scm.com/docs/githooks>
- Source `read-cache.c`: <https://github.com/git/git/blob/master/read-cache.c>
