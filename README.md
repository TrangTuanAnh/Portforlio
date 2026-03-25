# Portfolio An Ninh Mạng (Astro + Cloudflare Pages)

Portfolio static-first cho CTF writeup, security projects và blog kỹ thuật.
Giao diện hiện tại: light glass pastel, kèm hieu ung 3D nhe tren hero/card/info block.

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

## 4) Trung tâm chỉnh thông tin + upload file

Bạn chỉ cần làm việc ở **một thư mục chung**:

- `public/personal/profile.json`: chỉnh thông tin cá nhân
- `public/personal/uploads/`: upload file public (CV, avatar, cert...)

Ví dụ:

- `public/personal/uploads/resume.pdf` -> truy cập `/personal/uploads/resume.pdf`
- Trong `profile.json`, trường `resumeFile` đặt là `/personal/uploads/resume.pdf`

Các trang `Hero`, `About`, `Contact`, `Footer` đang đọc dữ liệu từ `public/personal/profile.json`.

## 5) Cấu trúc nội dung bài viết

- `src/content/ctf`: CTF writeup
- `src/content/projects`: Project/lab/tool
- `src/content/blog`: bài blog ngoài CTF
- `src/content.config.ts`: schema cho content collections

Với CTF writeup, bạn có thể chỉ lưu metadata trên site và nhảy ra repo bằng `externalUrl` trong frontmatter:

```md
externalUrl: "https://github.com/<username>/<repo>/blob/main/path/to/writeup.md"
```

Quy tắc hiển thị:

- `draft: true` => không hiển thị public
- Sort theo `date` giảm dần
- Khu vực featured trên trang chủ chỉ lấy `featured: true`

## 6) Deploy Cloudflare Pages

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

## 7) Checklist trước public

- [ ] Không có `.env`, token, API key, secret trong repo.
- [ ] Rà lại writeup để không lộ dữ liệu nhạy cảm/flag thật.
- [ ] Tất cả route chính mở được: `/`, `/ctf`, `/project`, `/blog`, `/about`, `/contact`.
- [ ] Ảnh/link ngoài không hỏng.
- [ ] Build production pass.

## 8) Backlog phase 2

- Filter/tag cho CTF và Blog
- Dark mode toggle theo preference người dùng
- Analytics nhẹ
- Contact form với Pages Functions (khi thật sự cần)
