# Deploy Guide Dokter Ulun

Panduan ini merangkum langkah deploy frontend dan backend Dokter Ulun ke server production dengan Nginx dan PM2.

## Ringkasan Arsitektur

- frontend dibuild dengan Vite menjadi folder `dist/`
- frontend disajikan oleh Nginx
- backend Express berjalan di port internal, misalnya `3000`
- Nginx melakukan proxy `/api` ke backend
- backend membaca konfigurasi dari `backend/.env`

## Struktur Yang Direkomendasikan

```text
/home/basoro/
├── dokter-ulun/                 # source project
│   ├── dist/                    # hasil build frontend
│   └── backend/
│       ├── index.js
│       ├── .env
│       └── package.json
└── ...
```

## 1. Persiapan Frontend

Di root project:

```bash
cd /Users/basoro/Server/data/www/dokter-ulun
npm install
cp .env.production.example .env.production
```

Isi file `.env.production` jika perlu:

```env
VITE_API_BASE_URL=/api
VITE_API_ORIGIN=https://dr.rshdbarabai.com
```

Build frontend:

```bash
npm run build
```

Hasil build ada di folder `dist/`.

## 2. Persiapan Backend

Di folder backend:

```bash
cd /Users/basoro/Server/data/www/dokter-ulun/backend
npm install
cp .env.production.example .env
```

Isi `backend/.env`:

```env
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://dr.rshdbarabai.com

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=mlite

ORTHANC_SERVER=http://127.0.0.1:8042
ORTHANC_USERNAME=your_orthanc_username
ORTHANC_PASSWORD=your_orthanc_password

PACS_ENABLED=true
PACS_BASE_URL=https://pacs.rshdbarabai.com
PACS_SERVICE_USERNAME=your_pacs_service_username
PACS_SERVICE_PASSWORD=your_pacs_service_password
PACS_REQUEST_TIMEOUT_MS=5000
PACS_REQUEST_RETRY_COUNT=1
PACS_VIEWER_LINK_TTL_MINUTES=1440
PACS_STUDY_CACHE_TTL_MS=120000

DIGITAL_FILES_BASE_URL=https://simrs.rshdbarabai.com/webapps/berkasrawat
```

Catatan PACS:

- akun service PACS wajib memakai role `TECHNICIAN` dengan permission `study:share` (lihat checklist go-live di `simrs-integration.md`)
- nilai `PACS_SERVICE_PASSWORD` disimpan hanya di `backend/.env` (jangan di variabel `VITE_*` atau kode frontend)
- `PACS_SERVER` / `PACS_USERNAME` / `PACS_PASSWORD` lama tetap dibaca sebagai alias, tetapi sebaiknya dirotasi dan dipindahkan ke variabel baru
- bila PACS tidak dapat dijangkau, foto radiologi tetap tampil dari Orthanc (badge `Orthanc (fallback)` di UI)

## 3. Menjalankan Backend Dengan PM2

Masih di folder backend:

```bash
pm2 start npm --name dokter-ulun-api -- start
pm2 save
```

Perintah penting:

```bash
pm2 status
pm2 logs dokter-ulun-api
pm2 restart dokter-ulun-api
pm2 stop dokter-ulun-api
pm2 delete dokter-ulun-api
```

Agar otomatis hidup setelah reboot:

```bash
pm2 startup
pm2 save
```

Jalankan command `pm2 startup` yang ditampilkan oleh server.

## 4. Menyalin Frontend Ke Web Root

Salin isi `dist/` ke document root Nginx Anda.

Contoh:

```bash
rsync -av --delete dist/ /www/wwwroot/dr.rshdbarabai.com/
```

Atau copy manual sesuai struktur server Anda.

## 5. Konfigurasi Nginx

Contoh konfigurasi minimal:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name dr.rshdbarabai.com;

    root /www/wwwroot/dr.rshdbarabai.com;
    index index.html index.htm index.php;

    ssl_certificate     /www/server/panel/vhost/cert/dr.rshdbarabai.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/dr.rshdbarabai.com/privkey.pem;

    location = /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

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
}
```

Setelah edit:

```bash
nginx -t
systemctl reload nginx
```

## 6. Checklist Setelah Deploy

Pastikan semua poin ini lolos:

- frontend build terbaru sudah masuk ke web root
- backend `pm2 status` menunjukkan `online`
- `backend/.env` sudah benar
- jika ingin cek health lewat domain, Nginx sudah proxy `/health`
- Nginx sudah punya `location /api/`
- Nginx sudah punya `try_files $uri $uri/ /index.html;`
- domain frontend sama dengan `FRONTEND_URL`

## 7. Verifikasi Cepat

### Health backend

```bash
curl http://127.0.0.1:3000/health
```

### Health lewat domain

```bash
curl https://dr.rshdbarabai.com/health
```

Route ini hanya berlaku jika Nginx juga memproxy `location = /health` ke backend.

### API login

```bash
curl -X POST https://dr.rshdbarabai.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

### Digital files

```bash
curl "https://dr.rshdbarabai.com/api/digital-files/20260510000104"
```

### Debug env digital files

```bash
curl "https://dr.rshdbarabai.com/api/debug/digital-files-env"
```

## 8. Checklist Update Aplikasi

Saat update aplikasi di server:

```bash
cd /home/basoro/dokter-ulun
git pull
npm install
npm run build
rsync -av --delete dist/ /www/wwwroot/dr.rshdbarabai.com/

cd backend
npm install
pm2 restart dokter-ulun-api
```

Jika ada perubahan `backend/.env`, pastikan restart backend setelahnya.

## 9. Masalah Umum

### Login gagal di production

Periksa:

- `FRONTEND_URL` di `backend/.env`
- Nginx sudah proxy `/api`
- backend hidup di port yang benar
- frontend build terbaru sudah terdeploy

### Route React 404 saat reload

Periksa:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### API mengarah ke localhost

Periksa:

- `.env.production`
- `VITE_API_BASE_URL`
- hasil build terbaru benar-benar terdeploy

### PACS tidak tampil

Periksa:

- `ORTHANC_SERVER`
- `ORTHANC_USERNAME`
- `ORTHANC_PASSWORD`
- akses backend ke server Orthanc

### Radiologi tampil dengan badge "Orthanc (fallback)"

Artinya PACS sedang tidak dipakai, gambar dilayani Orthanc. Periksa:

- `PACS_ENABLED=true`
- `PACS_BASE_URL` (atau alias `PACS_SERVER`) dapat dijangkau dari server backend
- `PACS_SERVICE_USERNAME` / `PACS_SERVICE_PASSWORD` (atau alias lama) valid
- nilai `fallback_reason` pada respons `/api/pacs/radiology-images`

### Berkas digital kosong

Periksa:

- `DIGITAL_FILES_BASE_URL`
- data tabel `berkas_digital_perawatan`
- response `/api/digital-files/:no_rawat`

## 10. File Referensi

- [README frontend](file:///Users/basoro/Server/data/www/dokter-ulun/README.md)
- [README backend](file:///Users/basoro/Server/data/www/dokter-ulun/backend/README.md)
- [Frontend env production](file:///Users/basoro/Server/data/www/dokter-ulun/.env.production.example)
- [Backend env production](file:///Users/basoro/Server/data/www/dokter-ulun/backend/.env.production.example)
