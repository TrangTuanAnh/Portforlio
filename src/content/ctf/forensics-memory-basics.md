---
title: "Phân tích memory dump cho thử thách forensics"
date: 2026-02-26
category: forensics
event: "Weekend Blue Team CTF"
difficulty: "Medium"
tags: ["memory", "forensics", "timeline"]
summary: "Quy trình dựng timeline từ memory dump để truy tìm tiến trình bất thường và IOC."
externalUrl: "https://github.com/example-security/ctf-writeups/blob/main/forensics/forensics-memory-basics.md"
featured: true
draft: false
---

## Mục tiêu

Từ file memory dump, xác định tiến trình độc hại và hành vi chính.

## Quy trình

1. Xác định profile phù hợp.
2. Liệt kê process tree và tìm parent-child bất thường.
3. Trích xuất network connections và đối chiếu IOC nội bộ.

## Điều rút ra

Khi dữ liệu lớn, ưu tiên dựng giả thuyết theo timeline rồi mới đào sâu từng artifact.
