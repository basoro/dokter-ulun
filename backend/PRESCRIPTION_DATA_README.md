# Prescription Data API Migration

This document describes the migration of the prescription-data functionality from Supabase Edge Functions to the local backend.

## Overview

The prescription-data endpoint provides comprehensive prescription management functionality including:
- Retrieving patient prescriptions
- Managing prescription details (medicines and compounds)
- CRUD operations for prescriptions
- Medicine and compound method lookups

## API Endpoints

### GET /api/prescription-data

Retrieves prescription-related data based on the action parameter.

#### Supported Actions:

1. **get_prescriptions** - Get all prescriptions for a patient
   ```bash
   curl "http://localhost:3002/api/prescription-data?action=get_prescriptions&no_rawat=2024/01/01/000001"
   ```

2. **get_prescription_details** - Get detailed prescription information
   ```bash
   curl "http://localhost:3002/api/prescription-data?action=get_prescription_details&no_resep=20240101120000"
   ```

3. **get_medicines** - Get available medicines
   ```bash
   curl "http://localhost:3002/api/prescription-data?action=get_medicines"
   ```

4. **get_compound_methods** - Get compound preparation methods
   ```bash
   curl "http://localhost:3002/api/prescription-data?action=get_compound_methods"
   ```

### POST /api/prescription-data

Manages prescription data with create, update, and delete operations.

#### Supported Actions:

1. **create_prescription** - Create a new prescription
   ```bash
   curl -X POST "http://localhost:3002/api/prescription-data" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create_prescription",
       "no_rawat": "2024/01/01/000001",
       "kd_dokter": "DR001",
       "medicines": [
         {
           "kode_brng": "MED001",
           "jml": 10,
           "aturan_pakai": "3x1 sehari sesudah makan"
         }
       ],
       "compounds": [
         {
           "no_racik": 1,
           "nama_racik": "Racikan A",
           "kd_racik": "RC001",
           "jml_dr": 5,
           "aturan_pakai": "2x1 sehari",
           "keterangan": "Racikan khusus"
         }
       ]
     }'
   ```

2. **update_prescription** - Update existing prescription
   ```bash
   curl -X POST "http://localhost:3002/api/prescription-data" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "update_prescription",
       "no_resep": "20240101120000",
       "medicines": [...],
       "compounds": [...]
     }'
   ```

3. **delete_prescription** - Delete a prescription
   ```bash
   curl -X POST "http://localhost:3002/api/prescription-data" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "delete_prescription",
       "no_resep": "20240101120000"
     }'
   ```

## Response Format

All endpoints return JSON responses with the following structure:

### Success Response
```json
{
  "success": true,
  "data": [...] // or other relevant data fields
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Database Tables

The service interacts with the following MySQL tables:

- **resep_obat** - Main prescription table
- **resep_dokter** - Prescription medicines
- **resep_dokter_racikan** - Prescription compounds
- **databarang** - Medicine/item master data
- **metode_racik** - Compound preparation methods
- **dokter** - Doctor information

## Implementation Details

### Service Location
- **File**: `backend/services/prescriptionDataService.js`
- **Class**: `PrescriptionDataService`

### Key Features
- Transaction support for data consistency
- Auto-generated prescription numbers
- Parallel queries for better performance
- Comprehensive error handling
- Input validation

### Database Configuration
The service uses the existing MySQL connection configuration from `backend/config/database.js`.

## Migration Notes

### Changes from Supabase
1. **Environment Variables**: No longer requires SUPABASE_URL and SUPABASE_ANON_KEY
2. **Database Connection**: Uses direct MySQL connection instead of Supabase client
3. **Error Handling**: Improved error messages and logging
4. **Performance**: Direct database queries for better performance
5. **Transactions**: Added proper transaction support for data integrity

### Frontend Integration
Update frontend calls from:
```javascript
// Old Supabase call
const { data } = await supabase.functions.invoke('prescription-data', {
  body: { action: 'get_medicines' }
});

// New backend call
const response = await fetch('http://localhost:3002/api/prescription-data?action=get_medicines');
const data = await response.json();
```

## Error Codes

- **400**: Bad Request - Missing required parameters or invalid action
- **500**: Internal Server Error - Database or server errors

## Testing

Test the endpoints using the provided curl examples above. Ensure your MySQL database is running and properly configured in the `.env` file.

## Security Considerations

- All database queries use parameterized statements to prevent SQL injection
- Input validation on all required parameters
- Transaction rollback on errors to maintain data integrity
- Proper error logging without exposing sensitive information