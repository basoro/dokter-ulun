# Update Examination API Documentation

## Overview
API endpoint untuk mengupdate data pemeriksaan pasien baik rawat jalan (Ralan) maupun rawat inap (Ranap). Endpoint ini telah dimigrasi dari Supabase Edge Function ke Express.js backend.

## Endpoints

### GET /api/update-examination/info
Mendapatkan informasi tentang endpoint update examination.

**Response:**
```json
{
  "success": true,
  "endpoint": "/api/update-examination",
  "method": "PUT",
  "description": "Update examination data for both Ralan and Ranap patients",
  "supported_tables": {
    "pemeriksaan_ralan": {
      "status_rawat": "Ralan",
      "fields": ["no_rawat", "tgl_perawatan", "jam_rawat", "suhu_tubuh", "tensi", "nadi", "respirasi", "tinggi", "berat", "gcs", "keluhan", "pemeriksaan", "rtl", "penilaian", "nip"]
    },
    "pemeriksaan_ranap": {
      "status_rawat": "Ranap",
      "fields": ["no_rawat", "tgl_perawatan", "jam_rawat", "suhu_tubuh", "tensi", "nadi", "respirasi", "tinggi", "berat", "spo2", "gcs", "kesadaran", "keluhan", "pemeriksaan", "rtl", "penilaian", "instruksi", "evaluasi", "nip"]
    }
  }
}
```

### PUT /api/update-examination
Mengupdate data pemeriksaan pasien.

**Request Body:**
```json
{
  "no_rawat": "2024/01/01/000001",
  "status_rawat": "Ralan", // "Ralan" atau "Ranap"
  "original_date": "2024-01-01",
  "original_time": "08:00:00",
  "tgl_perawatan": "2024-01-01",
  "jam_rawat": "08:30:00",
  "suhu": "36.5",
  "tensi": "120/80",
  "nadi": "80",
  "respirasi": "20",
  "tinggi": "170",
  "berat": "70",
  "gcs": "15",
  "keluhan": "Demam ringan",
  "pemeriksaan": "Pemeriksaan fisik normal",
  "rtl": "Istirahat cukup",
  "penilaian": "Kondisi stabil",
  "nip": "123456789",
  // Field tambahan untuk Ranap:
  "spo2": "98",
  "kesadaran": "Compos Mentis",
  "instruksi": "Minum obat teratur",
  "evaluasi": "Pasien membaik"
}
```

**Required Fields:**
- `no_rawat`: Nomor rawat pasien
- `status_rawat`: Status rawat ("Ralan" atau "Ranap")
- `original_date`: Tanggal perawatan asli untuk WHERE clause
- `original_time`: Jam rawat asli untuk WHERE clause

**Response Success:**
```json
{
  "success": true,
  "message": "Examination updated successfully",
  "table": "pemeriksaan_ralan",
  "data": {
    "affectedRows": 1,
    "table": "pemeriksaan_ralan",
    "no_rawat": "2024/01/01/000001",
    "tgl_perawatan": "2024-01-01",
    "jam_rawat": "08:30:00"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "error": "Internal Server Error",
  "details": "Error message details"
}
```

## Database Tables

### pemeriksaan_ralan (Rawat Jalan)
- Tidak memiliki kolom: `spo2`, `kesadaran`, `instruksi`, `evaluasi`
- Primary key: `no_rawat`, `tgl_perawatan`, `jam_rawat`

### pemeriksaan_ranap (Rawat Inap)
- Memiliki semua kolom termasuk: `spo2`, `kesadaran`, `instruksi`, `evaluasi`
- Primary key: `no_rawat`, `tgl_perawatan`, `jam_rawat`

## Migration Notes

### Dari Supabase Edge Function
1. **Runtime**: Deno → Node.js
2. **Framework**: Deno serve → Express.js
3. **Database Client**: Deno MySQL → mysql2
4. **Error Handling**: Ditingkatkan dengan logging yang lebih baik
5. **Validation**: Parameter validation untuk mencegah undefined values

### Perbedaan Implementasi
1. **CORS**: Ditangani oleh middleware Express.js
2. **Logging**: Menggunakan console.log dengan emoji untuk better readability
3. **Parameter Handling**: Automatic null conversion untuk undefined values
4. **Table Structure**: Disesuaikan dengan struktur database yang sebenarnya

## Testing

### Test Info Endpoint
```bash
curl -X GET http://localhost:3002/api/update-examination/info
```

### Test Update Ralan
```bash
curl -X PUT http://localhost:3002/api/update-examination \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2024/01/01/000001",
    "status_rawat": "Ralan",
    "original_date": "2024-01-01",
    "original_time": "08:00:00",
    "tgl_perawatan": "2024-01-01",
    "jam_rawat": "08:30:00",
    "suhu": "36.5",
    "tensi": "120/80",
    "nadi": "80",
    "respirasi": "20"
  }'
```

### Test Update Ranap
```bash
curl -X PUT http://localhost:3002/api/update-examination \
  -H "Content-Type: application/json" \
  -d '{
    "no_rawat": "2024/01/01/000001",
    "status_rawat": "Ranap",
    "original_date": "2024-01-01",
    "original_time": "08:00:00",
    "tgl_perawatan": "2024-01-01",
    "jam_rawat": "08:30:00",
    "spo2": "98",
    "kesadaran": "Compos Mentis",
    "instruksi": "Minum obat teratur",
    "evaluasi": "Pasien membaik"
  }'
```

## Error Handling

1. **Database Connection**: Timeout dan connection errors ditangani dengan graceful error response
2. **Parameter Validation**: Undefined parameters dikonversi ke null
3. **Table Structure**: Query disesuaikan dengan struktur tabel yang berbeda
4. **Logging**: Comprehensive logging untuk debugging

## Files Created/Modified

1. **routes/updateExamination.js** - Route handler
2. **services/updateExaminationService.js** - Business logic
3. **index.js** - Route registration
4. **UPDATE_EXAMINATION_README.md** - Documentation

Endpoint ini siap digunakan sebagai pengganti Supabase Edge Function untuk update examination data.