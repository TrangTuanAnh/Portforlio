# Portfolio An Ninh Mạng (Astro + Cloudflare Pages)

Portfolio static-first cho CTF writeup, security projects và blog kỹ thuật.

## 1) Yêu cầu môi trường

- Node.js LTS (khuyến nghị >= 22)
- npm

Kiểm tra nhanh:

```bash
node -v
npm -v
```

## 2) Chạy local

```bash
npm install
npm run dev
```

Site local mặc định: `http://localhost:4321`

## 3) Build production

```bash
npm run build
npm run preview
```

Output build: `dist/`

## 4) Cấu trúc nội dung

- `src/content/ctf`: CTF writeup
- `src/content/projects`: Project/lab/tool
- `src/content/blog`: bài blog ngoài CTF
- `src/content/config.ts`: schema cho content collections

Quy tắc hiển thị:

- `draft: true` => không hiển thị public
- Sort theo `date` giảm dần
- Khu vực featured trên trang chủ chỉ lấy `featured: true`

## 5) Deploy Cloudflare Pages

Thiết lập trong Cloudflare Pages:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
- Root directory: để trống (nếu repo chỉ chứa project này)

Luồng gợi ý:

1. Push code lên GitHub.
2. Kết nối repo với Cloudflare Pages.
3. Điền đúng build config bên trên.
4. Mỗi lần push `main` sẽ tự động deploy.

## 6) Checklist trước public

- [ ] Không có `.env`, token, API key, secret trong repo.
- [ ] Rà lại writeup để không lộ dữ liệu nhạy cảm/flag thật.
- [ ] Tất cả route chính mở được: `/`, `/ctf`, `/project`, `/blog`, `/about`, `/contact`.
- [ ] Ảnh/link ngoài không hỏng.
- [ ] Build production pass.

## 7) Backlog phase 2

- Filter/tag cho CTF và Blog
- Dark mode toggle theo preference người dùng
- Analytics nhẹ
- Contact form với Pages Functions (khi thật sự cần)
