# My Portfolio Workspace

Workspace cho portfolio CMS:

- `frontend/`: Astro SSR app + Cloudflare D1 + admin dashboard + WebGL hero.
- `backend/`: để trống (không dùng trong phase này).

## Chạy từ root

```bash
npm run install:frontend
npm run dev
```

## Root scripts

- `npm run install:frontend`: cài dependencies cho frontend
- `npm run dev`: chạy frontend dev server
- `npm run build`: build frontend
- `npm run preview`: preview frontend build

## Làm trực tiếp trong frontend

```bash
cd frontend
npm install
npm run db:migrate
npm run db:seed:generate
npm run db:seed
npm run dev
```

Chi tiết cấu hình env/admin/D1 xem trong `frontend/README.md`.
