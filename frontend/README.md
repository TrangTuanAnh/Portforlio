# Portfolio CMS (Astro SSR + Cloudflare D1)

Bản này đã chuyển từ static JSON/markdown runtime sang kiến trúc CMS:

- Public site render từ D1 theo thời gian thực.
- Hero có WebGL 3D (desktop) + fallback 2D (mobile/reduced motion).
- Có admin dashboard để quản lý profile, site config, và toàn bộ bài viết.

## 1) Cài dependencies

```bash
npm install
```

## 2) Cấu hình Cloudflare

File `wrangler.toml` đã có sẵn, cần thay:

- `database_id` trong `[[d1_databases]]`

Set secret/env cho runtime:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH` (bcrypt hash)
- `ADMIN_SESSION_SECRET`

Ví dụ tạo hash nhanh:

```bash
node -e "import('bcryptjs').then(({hash}) => hash('your-password', 12).then(console.log))"
```

## 3) Tạo schema + seed dữ liệu ban đầu

```bash
npm run db:migrate
npm run db:seed:generate
npm run db:seed
```

`db:seed:generate` sẽ đọc:

- `public/personal/profile.json`
- `public/personal/site-config.json`
- `src/content/**/*.md`

và tạo `migrations/0002_seed.sql` để import 1 lần vào D1.

## 4) Chạy app

```bash
npm run dev
```

Các route chính:

- Public: `/`, `/ctf`, `/project`, `/blog`, `/about`, `/contact`
- Admin login: `/admin/login`
- Admin dashboard: `/admin`

## 5) Admin API

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET/PUT /api/admin/profile`
- `GET/PUT /api/admin/site-config`
- `GET/POST /api/admin/posts`
- `GET/PUT/DELETE /api/admin/posts/:id`
- `POST /api/admin/markdown/preview`

## 6) Lưu ý vận hành

- Public site giờ lấy dữ liệu trực tiếp từ D1.
- Markdown/json cũ giữ lại để backup và làm nguồn seed, không còn là nguồn runtime chính.
- Non-GET admin API yêu cầu same-origin và session cookie `HttpOnly`.
