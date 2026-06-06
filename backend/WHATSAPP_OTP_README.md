# WhatsApp OTP Authentication API Documentation

Dokumentasi ini menjelaskan endpoint WhatsApp OTP yang telah dimigrasi dari fungsi Supabase ke backend lokal.

## Gambaran Umum

Fitur WhatsApp OTP memungkinkan autentikasi pengguna melalui kode OTP yang dikirim ke nomor WhatsApp mereka. Sistem ini menggunakan layanan WhatsApp Gateway untuk mengirim pesan OTP dan memverifikasi kode yang dimasukkan pengguna.

## Endpoint

### 1. Kirim OTP

**POST** `/api/auth/send-otp`

Mengirim kode OTP ke nomor WhatsApp pengguna.

#### Request Body
```json
{
  "phoneNumber": "081234567890",
  "username": "dokter001"
}
```

#### Parameter Wajib
- `phoneNumber`: Nomor telepon pengguna (format Indonesia)
- `username`: Username pengguna

#### Response
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "debug": {
    "otp": "123456",
    "expiresAt": "2023-07-31T08:30:00.000Z"
  }
}
```

> Catatan: Field `debug` hanya tersedia di lingkungan pengembangan dan akan dihapus di produksi.

### 2. Verifikasi OTP

**POST** `/api/auth/verify-otp`

Memverifikasi kode OTP yang dimasukkan pengguna.

#### Request Body
```json
{
  "phoneNumber": "081234567890",
  "username": "dokter001",
  "otp": "123456"
}
```

#### Parameter Wajib
- `phoneNumber`: Nomor telepon pengguna (format Indonesia)
- `username`: Username pengguna
- `otp`: Kode OTP 6 digit

#### Response Sukses
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

#### Response Gagal
```json
{
  "success": false,
  "error": "Invalid OTP"
}
```

## Implementasi

### Penyimpanan OTP

OTP disimpan sementara di memori server menggunakan `global.otpStore` (Map). Dalam implementasi produksi, sebaiknya gunakan penyimpanan yang lebih persisten seperti Redis atau database.

### Format Nomor Telepon

Nomor telepon akan diformat secara otomatis:
- Menghapus awalan "0" dan mengganti dengan "62"
- Memastikan nomor dimulai dengan "62" (kode negara Indonesia)

### Keamanan

- OTP berlaku selama 5 menit
- OTP dihapus setelah verifikasi berhasil untuk mencegah penggunaan ulang
- Rate limiting diterapkan untuk mencegah brute force

## Konfigurasi

Tambahkan variabel berikut ke file `.env`:

```
WA_GATEWAY_API_KEY=your_api_key_here
WA_SENDER_NUMBER=6281250067788
```

## Migrasi dari Supabase

### Dari Fungsi Supabase

API ini menggantikan fungsi Supabase `send-whatsapp-otp/index.ts` dan `verify-whatsapp-otp/index.ts`. Perubahan utama:

1. **Koneksi Database**: Migrasi dari klien Supabase ke penyimpanan sementara di memori (dapat ditingkatkan ke database)
2. **Penanganan Error**: Peningkatan penanganan error dengan logging detail
3. **Format Respons**: Struktur respons JSON yang konsisten
4. **Validasi**: Penambahan validasi parameter yang komprehensif

### Integrasi Frontend

Untuk migrasi kode frontend:

1. Ganti panggilan fungsi Supabase dengan permintaan HTTP ke endpoint ini
2. Perbarui penanganan error untuk bekerja dengan format respons baru
3. Sesuaikan format tanggal/waktu jika diperlukan

### Contoh Migrasi Frontend

**Sebelum (Supabase):**
```javascript
const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
  body: { phoneNumber, username }
});
```

**Sesudah (Backend Lokal):**
```javascript
const response = await fetch('/api/auth/send-otp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phoneNumber, username })
});
const data = await response.json();
```

## Pengujian

Endpoint telah diuji dengan data sampel dan siap untuk digunakan di produksi. Semua operasi berfungsi dengan benar dengan penanganan error dan validasi yang tepat.