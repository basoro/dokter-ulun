# Medical Scribe API

Endpoint untuk menggunakan AI assistant dalam dokumentasi medis menggunakan OpenAI GPT.

## Setup

### 1. Konfigurasi API Key

Tambahkan OpenAI API key ke file `.env`:

```env
OPENAI_API_KEY=your_actual_openai_api_key_here
```

### 2. Restart Server

Setelah menambahkan API key, restart backend server:

```bash
npm start
```

## Endpoint

### POST `/api/medical-scribe`

Menggunakan AI untuk memberikan saran dokumentasi medis SOAPIE.

#### Request Body

```json
{
  "text": "Deskripsi kondisi atau keluhan pasien",
  "no_rkm_medis": "Nomor rekam medis pasien",
  "patient_name": "Nama pasien"
}
```

#### Response Success

```json
{
  "result": "Saran dokumentasi medis dari AI"
}
```

#### Response Error

```json
{
  "success": false,
  "error": "Error message"
}
```

## Contoh Penggunaan

### cURL

```bash
curl -X POST http://localhost:3002/api/medical-scribe \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Pasien mengeluh demam sejak 2 hari, disertai batuk dan pilek",
    "no_rkm_medis": "123456",
    "patient_name": "John Doe"
  }'
```

### JavaScript/Frontend

```javascript
const response = await fetch('http://localhost:3002/api/medical-scribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Pasien mengeluh demam sejak 2 hari, disertai batuk dan pilek',
    no_rkm_medis: '123456',
    patient_name: 'John Doe'
  })
});

const data = await response.json();
console.log(data.result); // AI suggestion
```

## Konfigurasi AI

- **Model**: GPT-4o-mini
- **Max Tokens**: 500
- **Temperature**: 0.3 (untuk konsistensi medis)
- **System Prompt**: Disesuaikan untuk dokumentasi medis SOAPIE

## Error Handling

- `400`: Parameter tidak lengkap (text, no_rkm_medis, patient_name wajib)
- `500`: Error OpenAI API atau konfigurasi

## Keamanan

- API key disimpan di environment variables
- Tidak ada logging data sensitif pasien
- Rate limiting direkomendasikan untuk production

## Migrasi dari Supabase

Endpoint ini menggantikan fungsi Supabase `medical-scribe` dengan fungsionalitas yang sama:

- Input dan output format tetap sama
- Menggunakan OpenAI API yang sama
- Error handling yang lebih baik
- Integrasi langsung dengan backend lokal