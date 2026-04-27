---
title: "NaN — kẻ phá hoại các check số học trong Python"
date: "2026-04-25"
tags: [PYTHON, IEEE754, SECURITY]
type: blog
description: "Tại sao mọi so sánh với NaN đều ra False, NaN nuốt mọi phép toán, và những dòng code tưởng chừng an toàn nhưng nát bét khi gặp NaN."
---

# NaN — kẻ phá hoại các check số học trong Python

Code dạng này gặp suốt:

```python
if value <= 0:
    return  # bỏ qua, không xử lý
process(value)
```

Trông an toàn quá. Giá trị âm hoặc 0 thì bỏ — chỉ xử lý số dương. Không có gì để bàn.

Nhưng nếu `value` là **NaN** (Not-a-Number) thì sao? Dòng `if value <= 0` đó — không trigger. Code chạy tiếp xuống `process(value)` với một giá trị không-phải-số.

Bài này nói về 2 tính chất của NaN trong IEEE 754 mà về lý thuyết ai cũng biết, nhưng gặp trong thực tế vẫn ngơ.

## 1. NaN là gì

NaN xuất hiện khi một phép toán không có kết quả hợp lệ:

```python
>>> 0/0
ZeroDivisionError
>>> import math
>>> math.sqrt(-1)
ValueError
>>> 0.0/0.0
... wait, ValueError nốt? Không, cái này khác.
```

Khác là vì với `float`, Python tuân theo IEEE 754. `0.0/0.0` không raise, nó trả NaN:

```python
>>> import math
>>> nan = float('nan')        # cách 1
>>> nan = math.nan            # cách 2
>>> nan = 0.0 * float('inf')  # cách 3
>>> nan
nan
>>> type(nan)
<class 'float'>
```

NaN cũng có thể chui vào hệ thống qua nhiều ngả: parse JSON từ Python (`json.loads('NaN')` được, dù không đúng RFC 8259), Pandas đọc CSV thiếu giá trị, NumPy chia cho 0, sensor data, ML pipeline, etc. Tóm lại — **NaN có mặt nhiều hơn mình tưởng**.

## 2. Tính chất 1 — Mọi so sánh với NaN đều trả False

Đây là rule cơ bản nhất của IEEE 754:

```python
>>> nan = float('nan')
>>> nan == nan
False
>>> nan != nan
True       # cái duy nhất ra True
>>> nan < 0
False
>>> nan <= 0
False
>>> nan > 0
False
>>> nan >= 0
False
>>> 0 < nan < 100
False
```

Đúng vậy, **NaN không bằng chính nó**. Đây không phải bug Python, đây là spec IEEE 754: NaN biểu diễn "kết quả không xác định", và "không xác định bằng không xác định" thì cũng không xác định, nên rule là trả False.

Hậu quả thực tế: nếu logic dựa trên "lọc giá trị bất hợp lệ":

```python
def safe_division(amount, fee):
    if fee <= 0:
        raise ValueError("fee must be positive")
    return amount / fee

>>> safe_division(100, float('nan'))
nan         # KHÔNG raise. Trả về NaN âm thầm.
```

Hàm `safe_division` tin là đã lọc giá trị xấu, kết quả: trả NaN cho upstream, NaN tiếp tục lan truyền sang chỗ khác. Cuối hệ thống mới phát hiện ra thì cả pipeline đã ăn dữ liệu sai.

### Defensive pattern

Quy tắc: **đừng đảo logic check khi NaN có thể xuất hiện**.

```python
# ❌ Buggy — NaN lọt qua
if x <= 0:
    return

# ✅ An toàn — NaN cũng dính
if not (x > 0):       # not True = False, not False = True, not (NaN > 0) = not False = True
    return

# ✅ Hoặc check trước
if not math.isfinite(x):
    raise ValueError("x must be finite")
```

`math.isfinite(x)` trả `False` khi `x` là `NaN`, `+inf`, hoặc `-inf` — đây là cách rõ ràng nhất để loại trừ giá trị bất thường. Còn nếu chỉ muốn loại NaN: `math.isnan(x)`.

## 3. Tính chất 2 — Mọi phép toán với NaN trả NaN

```python
>>> nan + 1
nan
>>> nan * 0
nan
>>> nan ** 0      # 0^0 thường là 1, nhưng NaN^0 = nan
nan
>>> nan * float('inf')
nan
>>> abs(nan)
nan
>>> str(nan)
'nan'
>>> hash(nan)
0           # NaN có hash nha — set/dict vẫn nhận
```

Phép toán với NaN **gần như luôn ra NaN**. Có vài exception (`pow(nan, 0) = nan` ở Python nhưng `1` ở vài ngôn ngữ — IEEE 754-2008 thì là `1`, Python tuân `pow(nan, 0) = nan` để đồng bộ với `**`). Nhưng quy tắc chung: NaN nuốt mọi thứ.

Hậu quả: nếu code dùng giá trị tính toán ra để làm key, ID, hash — và giá trị đó vô tình NaN — thì:

```python
import hashlib, random
v = random.random() * float('nan')   # = nan
egg_id = hashlib.sha256(str(v).encode()).hexdigest()
# luôn = sha256('nan') = '9b2d5b4678781e53038e91ea5324530a03f27dc1d0e5f6c9bc9d493a23be9de0'
```

Cái ID tưởng là random, hoá ra **hằng số** với mọi user. Đây là cách bài [`egg`](https://github.com/TrangTuanAnh/B01lers-CTF-2026/tree/main/egg) ở B01lers CTF 2026 ăn flag — biến random bị NaN nuốt mất, mọi user collision sang cùng 1 egg ID. Verify nhanh trong REPL:

```python
>>> import random, hashlib
>>> nan = float('nan')
>>> for _ in range(5):
...     v = nan * random.random()
...     print(hashlib.sha256(str(v).encode()).hexdigest()[:16])
9b2d5b4678781e53
9b2d5b4678781e53
9b2d5b4678781e53
9b2d5b4678781e53
9b2d5b4678781e53
```

## 4. Vì sao Python parse `NaN` từ JSON

Nhân tiện, một detail hay vấp:

```python
>>> import json
>>> json.dumps({"x": float('nan')})
'{"x": NaN}'
>>> json.loads('{"x": NaN}')
{'x': nan}
```

Python xuất `NaN` không quote — không đúng RFC 8259 (JSON spec không có NaN). Browser `JSON.parse` sẽ throw, nhưng Python `json.loads` lại parse được.

Nghĩa là nếu service Python A gửi JSON có NaN sang service Python B — chạy ngon. Nhưng A gửi sang client JavaScript — vỡ. Hoặc client gửi `{"timestamp": NaN}` lên server Python — server **parse được**, và NaN chui vào logic.

Đây là cách kẻ tấn công forge cookie có `{"session_timestamp": NaN}` — server Python deserialize thành float NaN, NaN làm sập check `if time_diff <= 0`. Bài học: dùng `json.dumps(..., allow_nan=False)` để chặn NaN ở đầu ra:

```python
>>> json.dumps({"x": float('nan')}, allow_nan=False)
ValueError: Out of range float values are not JSON compliant
```

Hoặc validate input trước khi xài:

```python
data = json.loads(body)
for k, v in data.items():
    if isinstance(v, float) and not math.isfinite(v):
        raise BadRequest(f"non-finite value at {k}")
```

## 5. Anh em của NaN — `+inf` và `-inf`

`float('inf')` cũng là một con số "hợp lệ" trong IEEE 754:

```python
>>> inf = float('inf')
>>> inf > 0
True
>>> inf <= 0
False         # giống NaN trong case này
>>> inf - inf
nan
>>> 1 / inf
0.0
>>> str(inf)
'inf'
```

`+inf <= 0` cũng trả False, nên `if x <= 0: return` cũng để `+inf` lọt qua. Nhưng khác NaN ở chỗ `inf > 0 = True`, nên `if not (x > 0)` chặn được NaN nhưng **không chặn `+inf`**:

```python
if not (x > 0):
    return
# x = +inf vẫn lọt!
```

Cleanest pattern:

```python
if not math.isfinite(x):
    raise ValueError("x must be finite (not NaN or inf)")
```

## 6. Khi nào nên đặc biệt cảnh giác

- **Code nhận input từ user / API external**: timestamp, amount, score, percentage, anything số.
- **ML pipeline**: NaN từ missing data lan truyền nếu không `dropna()` hoặc `fillna()` từ sớm.
- **Calc tài chính**: chia 0, sqrt(âm), log(0). Một NaN âm thầm có thể làm sai cả báo cáo.
- **Hash / ID**: nếu ID build từ giá trị float, NaN làm collision toàn bộ user.
- **Set / dict**: NaN hash bằng 0, nhưng `nan != nan` — `{nan, nan}` cho 2 phần tử khác nhau, `dict.get(nan)` không lấy lại được.

## 7. Tóm tắt 1 dòng

> **NaN tồn tại để báo "tao không phải số hợp lệ" — nhưng kiểu so sánh trong code Python thường ngầm giả định mọi số đều "hợp lệ". Cứ chỗ nào assumption đó vỡ là bug nằm chờ.**

Pattern phòng thủ ngắn nhất:

```python
if not math.isfinite(x):
    raise ValueError(f"non-finite value: {x!r}")
```

Đặt câu này ở rìa hệ thống — chỗ data nhập vào — code phía trong đỡ phải lo NaN.
