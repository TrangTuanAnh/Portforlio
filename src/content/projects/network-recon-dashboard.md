---
title: "Network Recon Dashboard"
date: 2026-03-05
summary: "Dashboard nhỏ giúp tổng hợp kết quả quét nội bộ và theo dõi thay đổi cổng dịch vụ qua từng tuần."
stack: ["Python", "FastAPI", "SQLite", "Chart.js"]
repo: "https://github.com/example-security/network-recon-dashboard"
demo: "https://demo.example.com/recon-dashboard"
featured: true
draft: false
---

## Vấn đề giải quyết

Kết quả quét mạng thường nằm rải rác ở nhiều file khiến việc so sánh theo thời gian khá chậm.

## Cách làm

- Chuẩn hóa output từ tool scan thành schema chung.
- Lưu snapshot theo ngày.
- Hiển thị thay đổi cổng và service theo host.

## Giới hạn hiện tại

Chưa có cơ chế phân quyền nhiều người dùng, phù hợp nhất cho lab cá nhân hoặc nhóm nhỏ.
