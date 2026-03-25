---
title: "Blind SQL Injection cơ bản trên lab nội bộ"
date: 2026-03-12
category: web
event: "Internal Practice #07"
difficulty: "Medium"
tags: ["sqli", "payload", "debug"]
summary: "Ghi lại cách xác định blind SQLi bằng thời gian phản hồi và tối ưu payload để giảm false positive."
externalUrl: "https://github.com/example-security/ctf-writeups/blob/main/web/web-sqli-lab-notes.md"
featured: true
draft: false
---

## Bối cảnh

Mục tiêu của bài lab là xác định endpoint đăng nhập có tồn tại blind SQL injection hay không.

## Cách tiếp cận

1. So sánh phản hồi giữa payload chuẩn và payload gây delay.
2. Dùng chuỗi test ngắn trước khi brute-force dữ liệu.
3. Log lại thời gian phản hồi trung bình theo từng nhóm payload.

## Kết luận

Bài học chính là cần chuẩn hóa baseline trước khi kết luận có lỗ hổng để tránh nhầm lẫn do mạng chậm hoặc cache.
