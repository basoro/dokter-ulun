# Dokter Ulun Frontend

Frontend aplikasi Dokter Ulun dibangun dengan React, TypeScript, Vite, shadcn/ui, dan Tailwind CSS.

Panduan deploy end-to-end tersedia di [README-DEPLOY.md](file:///Users/basoro/Server/data/www/dokter-ulun/README-DEPLOY.md).

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router

## Struktur Singkat

```text
.
├── src/
│   ├── components/
│   ├── contexts/
│   ├── pages/
│   └── config/api.ts
├── public/
├── .env.development.example
├── .env.production.example
├── package.json
└── vite.config.ts
```

## Konfigurasi Frontend

Konfigurasi utama frontend ada di file berikut:

- [`vite.config.ts`](file:///Users/basoro/Server/data/www/dokter-ulun/vite.config.ts)
  - port development Vite
  - proxy `/api` ke backend lokal
- [`src/config/api.ts`](file:///Users/basoro/Server/data/www/dokter-ulun/src/config/api.ts)
  - pembentukan base URL API
  - fallback ke `/api` jika env tidak diisi

### Port dan URL Default

- Frontend dev: `http://localhost:8080`
- Backend dev: `http://localhost:3000`
- Proxy Vite:
  - `/api` -> `http://localhost:3000`

## Environment Variables

Template env yang tersedia:

- [`.env.development.example`](file:///Users/basoro/Server/data/www/dokter-ulun/.env.development.example)
- [`.env.production.example`](file:///Users/basoro/Server/data/www/dokter-ulun/.env.production.example)

### Variabel yang Dipakai

```env
VITE_API_BASE_URL=/api
VITE_API_ORIGIN=http://localhost:8080
```

Keterangan:

- `VITE_API_BASE_URL`
  - base URL semua request API frontend
  - default aman untuk production dengan Nginx adalah `/api`
- `VITE_API_ORIGIN`
  - origin tanpa suffix `/api`
  - dipakai untuk beberapa kebutuhan URL absolut

## Menjalankan Lokal

1. Install dependency:

```bash
npm install
```

2. Siapkan env development:

```bash
cp .env.development.example .env
```

3. Jalankan dev server:

```bash
npm run dev
```

4. Buka:

```text
http://localhost:8080
```

## Build Production

1. Siapkan env production:

```bash
cp .env.production.example .env.production
```

2. Build frontend:

```bash
npm run build
```

3. Hasil build ada di folder `dist/`

## Deploy Production

Skema yang direkomendasikan:

- frontend build disajikan oleh Nginx
- backend Node berjalan terpisah
- Nginx melakukan proxy `/api` ke backend

Karena frontend default memakai `/api`, Anda tidak perlu hardcode domain backend di kode frontend selama Nginx sudah benar.

### Contoh Alur Deploy

```bash
npm install
cp .env.production.example .env.production
npm run build
```

Lalu upload isi folder `dist/` ke document root web server.

## Catatan Nginx

Frontend production memerlukan dua hal:

- fallback SPA ke `index.html`
- proxy `/api` ke backend Node

Contoh minimal:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

## Troubleshooting

### Login gagal di production

Periksa:

- frontend sudah build terbaru
- Nginx sudah proxy `/api`
- backend berjalan di port yang benar
- `FRONTEND_URL` backend sesuai domain frontend

### Frontend bisa jalan, API gagal

Periksa:

- `VITE_API_BASE_URL`
- proxy di `vite.config.ts` untuk lokal
- konfigurasi `location /api/` di Nginx untuk production

### Route React 404 saat reload

Pastikan Nginx memakai:

```nginx
try_files $uri $uri/ /index.html;
```
