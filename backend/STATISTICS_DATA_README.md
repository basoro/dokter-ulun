# Statistics Data API Documentation

This document describes the Statistics Data API endpoints that have been migrated from Supabase functions to the local backend.

## Overview

The Statistics Data API provides comprehensive statistical analysis of medical data including:
- Visit statistics grouped by time periods
- Diagnosis statistics with case counts and percentages
- Doctor performance metrics
- Summary statistics with overall totals

## Endpoints

### 1. Get Statistics Data

**POST** `/api/statistics-data`

Retrieves statistics data based on the specified type and parameters.

#### Request Body

```json
{
  "statisticType": "visits|diagnosis|doctors|summary",
  "periodType": "daily|weekly|monthly|yearly",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "limit": 10
}
```

#### Parameters

- `statisticType` (required): Type of statistics to retrieve
  - `visits`: Visit statistics grouped by period
  - `diagnosis`: Top diagnoses with case counts
  - `doctors`: Doctor performance statistics
  - `summary`: Overall summary statistics
- `periodType` (optional): Period grouping for visits statistics
  - `daily`: Group by day
  - `weekly`: Group by week
  - `monthly`: Group by month (default)
  - `yearly`: Group by year
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `limit` (optional): Maximum number of results (default: 10)

#### Response Examples

**Visit Statistics:**
```json
{
  "success": true,
  "data": {
    "visits": [
      {
        "period": "2024-01",
        "total_visits": 150,
        "rawat_jalan": 120,
        "rawat_inap": 30
      }
    ],
    "totalVisits": 150,
    "totalRawatJalan": 120,
    "totalRawatInap": 30
  },
  "statisticType": "visits"
}
```

**Diagnosis Statistics:**
```json
{
  "success": true,
  "data": [
    {
      "nm_penyakit": "Hipertensi",
      "total_cases": 45,
      "percentage": 15.5
    }
  ],
  "statisticType": "diagnosis"
}
```

**Doctor Statistics:**
```json
{
  "success": true,
  "data": [
    {
      "nm_dokter": "Dr. John Doe",
      "kd_dokter": "DR001",
      "gender": "L",
      "rawat_jalan": 80,
      "rawat_inap": 20,
      "resep": 75,
      "payment_rate": 95.5
    }
  ],
  "statisticType": "doctors"
}
```

**Summary Statistics:**
```json
{
  "success": true,
  "data": {
    "totalVisits": 500,
    "careTypes": [
      { "status_lanjut": "Ralan", "count": 400 },
      { "status_lanjut": "Ranap", "count": 100 }
    ],
    "paymentStatus": [
      { "status_bayar": "Sudah Bayar", "count": 450 },
      { "status_bayar": "Belum Bayar", "count": 50 }
    ],
    "activeDoctors": 15,
    "topDiagnoses": [
      { "nm_penyakit": "Hipertensi", "cases": 45 }
    ]
  },
  "statisticType": "summary"
}
```

### 2. Get Available Types

**GET** `/api/statistics-data/types`

Retrieves information about available statistic types and their configurations.

#### Response

```json
{
  "success": true,
  "data": {
    "visits": {
      "description": "Visit statistics grouped by period",
      "periodTypes": ["daily", "weekly", "monthly", "yearly"],
      "defaultPeriod": "monthly"
    },
    "diagnosis": {
      "description": "Top diagnoses with case counts and percentages",
      "supportsLimit": true,
      "defaultLimit": 10
    },
    "doctors": {
      "description": "Doctor performance statistics including visits and prescriptions",
      "supportsLimit": true,
      "defaultLimit": 10
    },
    "summary": {
      "description": "Overall summary statistics including totals and top diagnoses",
      "supportsLimit": false
    }
  }
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "statisticType, startDate, and endDate are required"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error while fetching statistics data"
}
```

## Implementation Details

### Database Queries

The service uses MySQL queries to aggregate data from various tables:
- `reg_periksa`: Patient registration and visit data
- `diagnosa_pasien`: Patient diagnosis data
- `penyakit`: Disease/diagnosis master data
- `dokter`: Doctor master data
- `resep_obat`: Prescription data
- `kamar_inap`: Inpatient room data
- `dpjp_ranap`: Inpatient doctor assignment

### Data Processing

1. **Visit Statistics**: Groups visits by specified time periods and separates outpatient vs inpatient cases
2. **Diagnosis Statistics**: Calculates case counts and percentages for each diagnosis
3. **Doctor Statistics**: Aggregates performance metrics including visit counts, prescriptions, and payment rates
4. **Summary Statistics**: Provides overall totals and key performance indicators

### Performance Considerations

- Queries are optimized with appropriate indexes
- Results are limited to prevent excessive data transfer
- Date range validation prevents overly broad queries
- Connection pooling is used for database efficiency

## Migration from Supabase

This API replaces the Supabase function `statistics-data` with the following improvements:

1. **Better Error Handling**: More detailed error messages and proper HTTP status codes
2. **Input Validation**: Comprehensive validation of request parameters
3. **Performance**: Optimized MySQL queries with proper indexing
4. **Flexibility**: Support for different period types and configurable limits
5. **Documentation**: Complete API documentation with examples

## Frontend Integration

### Example Usage

```javascript
// Get monthly visit statistics
const visitStats = await fetch('/api/statistics-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statisticType: 'visits',
    periodType: 'monthly',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  })
});

// Get top 5 diagnoses
const diagnosisStats = await fetch('/api/statistics-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statisticType: 'diagnosis',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    limit: 5
  })
});

// Get summary statistics
const summaryStats = await fetch('/api/statistics-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statisticType: 'summary',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  })
});
```

## Testing

Test the endpoints using curl or your preferred API testing tool:

```bash
# Test visit statistics
curl -X POST http://localhost:3001/api/statistics-data \
  -H "Content-Type: application/json" \
  -d '{
    "statisticType": "visits",
    "periodType": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'

# Test available types
curl http://localhost:3001/api/statistics-data/types
```