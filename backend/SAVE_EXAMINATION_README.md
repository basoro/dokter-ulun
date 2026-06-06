# Save Examination API Documentation

This document describes the save-examination endpoints that have been migrated from Supabase functions to the local backend.

## Overview

The save-examination functionality handles patient examination data for both outpatient (Ralan) and inpatient (Ranap) care. It provides comprehensive CRUD operations for examination records including vital signs, measurements, and clinical notes.

## Endpoints

### 1. Save/Update Examination

**POST** `/api/save-examination`

Saves or updates examination data for a patient.

#### Request Body
```json
{
  "no_rawat": "2025/07/31/000001",
  "status_rawat": "Ralan",
  "tgl_perawatan": "2025-07-31",
  "jam_rawat": "08:00:00",
  "suhu": "36.5",
  "tensi": "120/80",
  "nadi": "80",
  "respirasi": "20",
  "tinggi": "170",
  "berat": "70",
  "gcs": "15",
  "keluhan": "Patient complaints",
  "pemeriksaan": "Physical examination findings",
  "rtl": "Treatment plan",
  "penilaian": "Assessment",
  "nip": "DR001"
}
```

#### Required Fields
- `no_rawat`: Patient care number
- `status_rawat`: Care status ("Ralan" for outpatient, "Ranap" for inpatient)
- `tgl_perawatan`: Care date (YYYY-MM-DD format)
- `jam_rawat`: Care time (HH:MM:SS format)
- `nip`: Doctor/practitioner ID

#### Response
```json
{
  "success": true,
  "message": "Examination saved successfully",
  "table": "pemeriksaan_ralan",
  "data": {
    "no_rawat": "2025/07/31/000001",
    "tgl_perawatan": "2025-07-31",
    "jam_rawat": "08:00:00",
    "affectedRows": 1,
    "action": "created"
  }
}
```

### 2. Get Examination Details

**GET** `/api/examination/:no_rawat/:tgl_perawatan/:status_rawat`

Retrieves examination records for a specific patient on a specific date.

#### Parameters
- `no_rawat`: Patient care number (URL encoded)
- `tgl_perawatan`: Care date (YYYY-MM-DD format)
- `status_rawat`: Care status ("Ralan" or "Ranap")

#### Example
```bash
curl -X GET "http://localhost:3002/api/examination/2025%2F07%2F31%2F000001/2025-07-31/Ralan"
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "no_rawat": "2025/07/31/000001",
      "tgl_perawatan": "2025-07-31T00:00:00.000Z",
      "jam_rawat": "08:00:00",
      "suhu": "36.5",
      "tensi": "120/80",
      "nadi": "80",
      "respirasi": "20",
      "tinggi": "170",
      "berat": "70",
      "gcs": "15",
      "keluhan": "Patient complaints",
      "pemeriksaan": "Physical examination findings",
      "rtl": "Treatment plan",
      "penilaian": "Assessment",
      "nip": "DR001"
    }
  ],
  "table": "pemeriksaan_ralan"
}
```

### 3. Get Examination History

**GET** `/api/examination-history/:no_rawat/:status_rawat`

Retrieves examination history for a patient with optional pagination.

#### Parameters
- `no_rawat`: Patient care number (URL encoded)
- `status_rawat`: Care status ("Ralan" or "Ranap")
- `limit` (optional): Number of records to return (default: 10)

#### Example
```bash
curl -X GET "http://localhost:3002/api/examination-history/2025%2F07%2F31%2F000001/Ralan?limit=5"
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "no_rawat": "2025/07/31/000001",
      "tgl_perawatan": "2025-07-31T00:00:00.000Z",
      "jam_rawat": "08:00:00",
      "suhu": "36.5",
      "tensi": "120/80",
      "nadi": "80",
      "respirasi": "20",
      "tinggi": "170",
      "berat": "70",
      "gcs": "15",
      "keluhan": "Patient complaints",
      "pemeriksaan": "Physical examination findings",
      "rtl": "Treatment plan",
      "penilaian": "Assessment",
      "nip": "DR001"
    }
  ],
  "table": "pemeriksaan_ralan",
  "count": 1
}
```

### 4. Delete Examination

**DELETE** `/api/examination/:no_rawat/:tgl_perawatan/:jam_rawat/:status_rawat`

Deletes a specific examination record.

#### Parameters
- `no_rawat`: Patient care number (URL encoded)
- `tgl_perawatan`: Care date (YYYY-MM-DD format)
- `jam_rawat`: Care time (HH:MM:SS format, URL encoded)
- `status_rawat`: Care status ("Ralan" or "Ranap")

#### Example
```bash
curl -X DELETE "http://localhost:3002/api/examination/2025%2F07%2F31%2F000001/2025-07-31/08%3A00%3A00/Ralan"
```

#### Response
```json
{
  "success": true,
  "message": "Examination deleted successfully",
  "data": {
    "no_rawat": "2025/07/31/000001",
    "tgl_perawatan": "2025-07-31",
    "jam_rawat": "08:00:00",
    "affectedRows": 1
  }
}
```

## Database Tables

The service works with two main tables:

### pemeriksaan_ralan (Outpatient Examinations)
- Used when `status_rawat` = "Ralan"
- Contains 17 fields including vital signs and clinical notes

### pemeriksaan_ranap (Inpatient Examinations)
- Used when `status_rawat` = "Ranap"
- Contains 19 fields with additional inpatient-specific data

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing required parameters)
- `404`: Not Found (examination record not found)
- `500`: Internal Server Error

## Migration Notes

### From Supabase Function

This API replaces the Supabase function `save-examination/index.ts`. Key changes:

1. **Database Connection**: Migrated from Supabase client to MySQL connection pool
2. **Error Handling**: Enhanced error handling with detailed logging
3. **Response Format**: Consistent JSON response structure
4. **Validation**: Added comprehensive parameter validation
5. **CRUD Operations**: Extended functionality beyond just save/update

### Frontend Integration

To migrate frontend code:

1. Replace Supabase function calls with HTTP requests to these endpoints
2. Update error handling to work with new response format
3. Adjust date/time formatting as needed
4. Update authentication headers if required

### Example Frontend Migration

**Before (Supabase):**
```javascript
const { data, error } = await supabase.functions.invoke('save-examination', {
  body: examinationData
});
```

**After (Local Backend):**
```javascript
const response = await fetch('/api/save-examination', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(examinationData)
});
const data = await response.json();
```

## Testing

The endpoints have been tested with sample data and are ready for production use. All CRUD operations work correctly with proper error handling and validation.