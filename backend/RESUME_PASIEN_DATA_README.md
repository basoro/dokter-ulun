# Resume Pasien Data API Documentation

## Overview
This API provides endpoints for managing patient resume data (resume pasien ranap) in the hospital management system. It handles inpatient discharge summaries and medical records.

## Base URL
```
http://localhost:3002/api/resume-pasien-data
```

## Endpoints

### 1. Get Resume Pasien Data (List)
**POST** `/api/resume-pasien-data`

Retrieves a paginated list of patient resume data with filtering options.

#### Request Body
```json
{
  "page": "1",
  "itemsPerPage": "50",
  "search": "",
  "statusPulang": "all",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

#### Parameters
- `page` (string, optional): Page number (default: "1")
- `itemsPerPage` (string, optional): Items per page (default: "50")
- `search` (string, optional): Search by patient name or medical record number
- `statusPulang` (string, optional): Discharge status filter ("all", "Pulang Paksa", "Atas Persetujuan Dokter", etc.)
- `startDate` (string, optional): Start date filter (YYYY-MM-DD format)
- `endDate` (string, optional): End date filter (YYYY-MM-DD format)

#### Response
```json
{
  "success": true,
  "data": [
    {
      "no_rawat": "2025/07/30/000903",
      "no_rkm_medis": "219251",
      "nm_pasien": "PATIENT NAME",
      "jenis_kelamin": "P",
      "tgl_lahir": "1999-07-19",
      "tgl_masuk": "2025-07-30",
      "tgl_keluar": "2025-07-31",
      "lama": 1,
      "stts_pulang": "Pindah Kamar",
      "kd_kamar": "4C (TINDAKAN)",
      "nm_bangsal": "DARUSSALAM",
      "dokter_dpjp": "dr. Doctor Name",
      "diagnosa_awal": null,
      "kd_diagnosa_utama": null,
      "diagnosa_utama": null,
      "kd_diagnosa_sekunder": null,
      "diagnosa_sekunder": null,
      "prosedur_utama": null,
      "prosedur_sekunder": null,
      "keadaan": null,
      "ket_keadaan": null,
      "status_resume": "belum_resume",
      "tgl_registrasi": ""
    }
  ],
  "total": 309470,
  "limit": 10,
  "offset": 0,
  "page": 1,
  "totalPages": 30947
}
```

### 2. Get Resume Detail
**GET** `/api/resume-pasien-data/:no_rawat`

Retrieves detailed resume information for a specific patient admission.

#### Parameters
- `no_rawat` (string, required): Patient admission number (URL encoded)

#### Example
```bash
curl -X GET "http://localhost:3002/api/resume-pasien-data/2025%2F07%2F30%2F000903"
```

#### Response
```json
{
  "success": true,
  "data": {
    "no_rawat": "2025/07/30/000903",
    "kd_dokter": "DR001",
    "diagnosa_awal": "Initial diagnosis",
    "alasan_masuk": "Reason for admission",
    "riwayat_penyakit": "Medical history",
    "pemeriksaan_fisik": "Physical examination",
    "diagnosa_utama": "Primary diagnosis",
    "diagnosa_sekunder": "Secondary diagnosis",
    "prosedur_utama": "Primary procedure",
    "prosedur_sekunder": "Secondary procedure",
    "kondisi_pulang": "Discharge condition",
    "keadaan": "Patient condition",
    "ket_keadaan": "Condition description",
    "obat_pulang": "Discharge medications",
    "nasihat": "Medical advice",
    "kontrol": "Follow-up schedule"
  }
}
```

### 3. Save Resume
**POST** `/api/resume-pasien-data/:no_rawat`

Creates or updates a patient resume.

#### Parameters
- `no_rawat` (string, required): Patient admission number (URL encoded)

#### Request Body
```json
{
  "kd_dokter": "DR001",
  "diagnosa_awal": "Initial diagnosis",
  "alasan_masuk": "Reason for admission",
  "riwayat_penyakit": "Medical history",
  "pemeriksaan_fisik": "Physical examination",
  "diagnosa_utama": "Primary diagnosis",
  "diagnosa_sekunder": "Secondary diagnosis",
  "prosedur_utama": "Primary procedure",
  "prosedur_sekunder": "Secondary procedure",
  "kondisi_pulang": "Discharge condition",
  "keadaan": "Patient condition",
  "ket_keadaan": "Condition description",
  "obat_pulang": "Discharge medications",
  "nasihat": "Medical advice",
  "kontrol": "Follow-up schedule"
}
```

#### Response
```json
{
  "success": true,
  "message": "Resume saved successfully",
  "data": {
    "no_rawat": "2025/07/30/000903",
    "action": "created" // or "updated"
  }
}
```

### 4. Delete Resume
**DELETE** `/api/resume-pasien-data/:no_rawat`

Deletes a patient resume.

#### Parameters
- `no_rawat` (string, required): Patient admission number (URL encoded)

#### Response
```json
{
  "success": true,
  "message": "Resume deleted successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "no_rawat is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resume not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

## Database Tables

This API interacts with the following database tables:
- `kamar_inap` - Inpatient room data
- `resume_pasien_ranap` - Patient resume data
- `reg_periksa` - Registration data
- `pasien` - Patient data
- `dpjp_ranap` - Attending physician data
- `dokter` - Doctor data
- `kamar` - Room data
- `bangsal` - Ward data

## Usage Examples

### Frontend Integration

```javascript
// Get resume list
const getResumeList = async (filters) => {
  const response = await fetch('http://localhost:3002/api/resume-pasien-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filters)
  });
  return response.json();
};

// Get resume detail
const getResumeDetail = async (noRawat) => {
  const encodedNoRawat = encodeURIComponent(noRawat);
  const response = await fetch(`http://localhost:3002/api/resume-pasien-data/${encodedNoRawat}`);
  return response.json();
};

// Save resume
const saveResume = async (noRawat, resumeData) => {
  const encodedNoRawat = encodeURIComponent(noRawat);
  const response = await fetch(`http://localhost:3002/api/resume-pasien-data/${encodedNoRawat}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resumeData)
  });
  return response.json();
};

// Delete resume
const deleteResume = async (noRawat) => {
  const encodedNoRawat = encodeURIComponent(noRawat);
  const response = await fetch(`http://localhost:3002/api/resume-pasien-data/${encodedNoRawat}`, {
    method: 'DELETE'
  });
  return response.json();
};
```

## Migration from Supabase

This API replaces the Supabase Edge Function `resume-pasien-data`. Update your frontend calls from:

```javascript
// Old Supabase call
const { data, error } = await supabase.functions.invoke('resume-pasien-data', {
  body: { /* parameters */ }
});

// New local backend call
const response = await fetch('http://localhost:3002/api/resume-pasien-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* parameters */ })
});
const data = await response.json();
```

## Notes

- All date fields are formatted as YYYY-MM-DD
- The `no_rawat` parameter in URLs must be URL encoded due to forward slashes
- Pagination is 1-indexed
- Search functionality works on patient names and medical record numbers
- Status filters support various discharge statuses from the hospital system
- The API maintains transaction integrity for data modifications
- All endpoints include proper error handling and logging