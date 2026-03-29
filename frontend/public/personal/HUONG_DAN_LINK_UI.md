# Huong Dan Nhanh: Link + Giao Dien

## 1) Chinh link va thong so giao dien tai 1 cho

File trung tam:

- `public/personal/site-config.json`

Ban co the sua:

- `links.heroPrimary`: link nut `Xem CTF Writeup`
- `links.heroSecondary`: link nut `Kham pha Project`
- `links.heroContact`: link nut lien he nhanh (thuong la `mailto:...`)
- `links.writeupRepoRoot`: link repo tong chua writeup
- `ui.enable3dEffects`: `true/false` bat tat hieu ung 3D
- `ui.heroTiltMax`, `ui.cardTiltMax`, `ui.infoTiltMax`: do nghieng 3D

## 2) Gan link writeup

Moi bai CTF nam trong:

- `src/content/ctf/*.md`

Gan link ra repo bang field:

```md
externalUrl: "https://github.com/<username>/<repo>/blob/main/path/to/writeup.md"
```

Neu co `externalUrl`, card CTF se mo link ngoai.
Neu khong co, card CTF mo trang chi tiet local.

## 3) Chinh thong tin ca nhan

File:

- `public/personal/profile.json`

## 4) Upload file public

Thu muc:

- `public/personal/uploads/`

Vi du:

- `public/personal/uploads/resume.pdf` -> truy cap qua `/personal/uploads/resume.pdf`
