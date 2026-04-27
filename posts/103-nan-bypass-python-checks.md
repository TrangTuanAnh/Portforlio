---
title: "NaN bypass check số trong Python"
date: "2026-04-25"
tags: [PYTHON, IEEE754, SECURITY]
type: blog
description: "NaN làm sập mọi so sánh trả False, NaN nuốt mọi phép toán. Dòng `if x <= 0` trông an toàn nhưng lủng khi `x = NaN`."
---

# NaN bypass check số trong Python

```python
if value <= 0:
    return                # bỏ qua giá trị xấu
process(value)
```

Trông an toàn. Nhưng `value = float('nan')` thì check trên **không trigger**, code chạy tiếp với 1 thứ không-phải-số.

## So sánh với NaN luôn ra False

IEEE 754 spec: NaN biểu diễn "không xác định", và "không xác định bằng không xác định" cũng không xác định, nên rule là trả False.

```python
>>> nan = float('nan')
>>> nan == nan
False
>>> nan != nan
True             # cái duy nhất ra True
>>> nan < 0
False
>>> nan <= 0
False
>>> nan > 0
False
>>> 0 < nan < 100
False
```

NaN **không bằng chính nó**. Vậy nên:

```python
def safe_division(amount, fee):
    if fee <= 0:
        raise ValueError("fee must be positive")
    return amount / fee

>>> safe_division(100, float('nan'))
nan              # KHÔNG raise. Trả NaN âm thầm.
```

Hàm tin là đã lọc giá trị xấu --> NaN lan truyền sang chỗ khác. Cuối hệ thống mới phát hiện thì cả pipeline đã ăn dữ liệu sai.

Pattern phòng thủ:

```python
if not (x > 0):           # NaN: not False = True --> dính
    return

# Tốt nhất:
if not math.isfinite(x):
    raise ValueError(f"non-finite: {x!r}")
```

`math.isfinite(x)` trả `False` cho NaN, +inf, -inf. Loại trừ thẳng cả 3 trường hợp lệch.

## Phép toán với NaN ra NaN

```python
>>> nan + 1
nan
>>> nan * 0
nan
>>> nan ** 0       # 0^0 thường = 1, NaN^0 = nan
nan
>>> nan * float('inf')
nan
>>> abs(nan)
nan
>>> str(nan)
'nan'
>>> hash(nan)
0                  # NaN có hash. set/dict vẫn nhận.
```

Phép toán với NaN gần như luôn ra NaN. Hậu quả: nếu code build ID/hash/key từ giá trị float, NaN làm collision toàn bộ user.

```python
import random, hashlib
v = random.random() * float('nan')
egg_id = hashlib.sha256(str(v).encode()).hexdigest()
# luôn = sha256('nan').hexdigest()
# = '9b2d5b4678781e53038e91ea5324530a03f27dc1d0e5f6c9bc9d493a23be9de0'
```

ID tưởng random, hoá ra hằng số với mọi user. Đây là cách bài [`egg`](https://github.com/TrangTuanAnh/B01lers-CTF-2026/tree/main/egg) ở B01lers CTF 2026 ăn flag.

Verify nhanh trong REPL:

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

## Python parse NaN từ JSON

```python
>>> import json
>>> json.dumps({"x": float('nan')})
'{"x": NaN}'                       # không quote, không đúng RFC 8259
>>> json.loads('{"x": NaN}')
{'x': nan}                          # parse được
```

Python `json.dumps` xuất `NaN` không quote — JS `JSON.parse` throw, nhưng Python `json.loads` ăn ngon. Service Python A gửi sang Python B chạy ngon, A gửi sang JS client vỡ. Hoặc client gửi `{"timestamp": NaN}` lên server Python --> server parse được, NaN chui vào logic.

Đây là cách kẻ tấn công bài `egg` forge cookie có `{"session_timestamp": NaN}` rồi sập check `if time_diff <= 0`.

Fix: chặn ở rìa I/O.

```python
json.dumps(data, allow_nan=False)        # raise nếu có NaN
```

Hoặc validate input:

```python
data = json.loads(body)
for k, v in data.items():
    if isinstance(v, float) and not math.isfinite(v):
        raise BadRequest(f"non-finite value at {k}")
```

## Anh em của NaN — `+inf`, `-inf`

```python
>>> inf = float('inf')
>>> inf > 0
True
>>> inf <= 0
False                    # giống NaN ở case này
>>> 1 / inf
0.0
```

`+inf` qua được `if x <= 0: return` y như NaN. Nhưng khác NaN: `inf > 0 = True`, nên `if not (x > 0)` chặn được NaN nhưng **không chặn `+inf`**.

Cleanest vẫn là `math.isfinite(x)` — chặn được cả NaN, +inf, -inf trong 1 dòng.

## Khi nào cảnh giác

- Input từ user / API external (timestamp, amount, score, percentage).
- ML pipeline — NaN từ missing data lan truyền nếu không `dropna`/`fillna` sớm.
- Calc tài chính — chia 0, sqrt(âm), log(0). NaN âm thầm làm sai báo cáo.
- ID/hash — float trong key.
- Set/dict — `hash(nan) == 0` nhưng `nan != nan`. `{nan, nan}` cho 2 phần tử khác nhau, `dict.get(nan)` không lấy lại được giá trị.

Đặt `if not math.isfinite(x): raise` ở rìa hệ thống, code phía trong đỡ phải lo.
