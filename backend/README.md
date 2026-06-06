# Dokter Ulun Backend API

Backend server untuk aplikasi Dokter Ulun yang terhubung ke database MySQL.

## Fitur

- ✅ Autentikasi pengguna dengan bcrypt
- ✅ Manajemen data rekam medis
- ✅ Data pasien rawat jalan dan rawat inap
- ✅ Pencarian pasien
- ✅ Rate limiting dan security middleware
- ✅ Error handling yang robust
- ✅ Validasi input
- ✅ Connection pooling untuk database

## Struktur Proyek

```
backend/
├── config/
│   └── database.js          # Konfigurasi database MySQL
├── middleware/
│   ├── errorHandler.js      # Error handling middleware
│   └── validation.js        # Input validation middleware
├── routes/
│   ├── auth.js             # Routes untuk autentikasi
│   └── medical.js          # Routes untuk data medis
├── services/
│   ├── authService.js      # Service untuk autentikasi
│   └── medicalService.js   # Service untuk data medis
├── .env                    # Environment variables
├── index.js               # Main server file
├── package.json           # Dependencies
└── README.md             # Dokumentasi ini
```

## Instalasi

1. Install dependencies:
```bash
cd backend
npm install
```

2. Setup environment variables di file `.env`:
```env
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_mysql_database
MYSQL_PORT=your_mysql_port
FRONTEND_URL=http://localhost:8084
NODE_ENV=development
PORT=3000
```

3. Jalankan server:
```bash
# Development mode dengan auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Cek status server

### Authentication
- `POST /api/auth/login` - Login pengguna
- `GET /api/auth/profile/:username` - Get user profile
- `POST /api/auth/validate-poli` - Validasi akses poli
- `POST /api/auth/logout` - Logout pengguna

### Medical Data
- `POST /api/medical/medical-record` - Get rekam medis
- `POST /api/medical/rawat-jalan-patients` - Get data pasien rawat jalan
- `GET /api/medical/search-patients` - Pencarian pasien
- `GET /api/medical/outpatient-visits/:no_rkm_medis` - Get kunjungan rawat jalan
- `GET /api/medical/inpatient-visits/:no_rkm_medis` - Get kunjungan rawat inap
- `GET /api/medical/health` - Health check medical service

## Contoh Penggunaan

### Login
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "username": "dokter001",
  "password": "password123",
  "remember": false
}
```

### Get Rekam Medis
```javascript
POST /api/medical/medical-record
Content-Type: application/json

{
  "no_rkm_medis": "000001",
  "no_rawat": "2024/01/01/000001"
}
```

### Get Pasien Rawat Jalan
```javascript
POST /api/medical/rawat-jalan-patients
Content-Type: application/json

{
  "kd_poli": "U0001",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "status": "all",
  "statusBayar": "all",
  "page": 1,
  "itemsPerPage": 10
}
```

### Pencarian Pasien
```javascript
GET /api/medical/search-patients?q=nama_pasien&limit=10
```

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Pembatasan request per IP
- **Input Sanitization**: Pembersihan input dari karakter berbahaya
- **Password Hashing**: Menggunakan bcrypt untuk password
- **Error Handling**: Error handling yang aman tanpa expose sensitive data

## Database Schema

Backend ini menggunakan tabel-tabel berikut dari database MySQL:

- `mlite_users` - Data pengguna/dokter
- `dokter` - Data dokter
- `pasien` - Data pasien
- `reg_periksa` - Data registrasi pemeriksaan
- `rawat_jl_dr` - Data rawat jalan dokter
- `periksa_lab` - Data pemeriksaan laboratorium
- `ranap_inap` - Data rawat inap
- `poliklinik` - Data poliklinik
- `penjab` - Data penanggung jawab

## Development

### Menambah Endpoint Baru

1. Buat service di folder `services/`
2. Buat route di folder `routes/`
3. Tambahkan validation jika diperlukan di `middleware/validation.js`
4. Import route di `index.js`

### Testing

Untuk testing API, gunakan tools seperti:
- Postman
- Insomnia
- curl
- Thunder Client (VS Code extension)

## Troubleshooting

### Database Connection Error
- Pastikan MySQL server berjalan
- Cek konfigurasi di file `.env`
- Pastikan user memiliki akses ke database

### Rate Limiting
- Jika terkena rate limit, tunggu 15 menit atau restart server
- Sesuaikan konfigurasi rate limit di `index.js`

### CORS Error
- Pastikan `FRONTEND_URL` di `.env` sesuai dengan URL frontend
- Cek konfigurasi CORS di `index.js`

## Kontribusi

1. Fork repository
2. Buat branch feature (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## License

ISC License