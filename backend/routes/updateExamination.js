import express from 'express';
import { updateExaminationData } from '../services/updateExaminationService.js';

const router = express.Router();

// GET /api/update-examination/info - Get information about update examination endpoint
router.get('/info', (req, res) => {
  console.log('📋 GET /api/update-examination/info endpoint called!');
  
  res.json({
    success: true,
    endpoint: '/api/update-examination',
    method: 'PUT',
    description: 'Update examination data for both Ralan and Ranap patients',
    supported_tables: {
      pemeriksaan_ralan: {
        status_rawat: 'Ralan',
        fields: ['no_rawat', 'tgl_perawatan', 'jam_rawat', 'suhu_tubuh', 'tensi', 'nadi', 'respirasi', 'tinggi', 'berat', 'gcs', 'keluhan', 'pemeriksaan', 'rtl', 'penilaian', 'nip']
      },
      pemeriksaan_ranap: {
        status_rawat: 'Ranap',
        fields: ['no_rawat', 'tgl_perawatan', 'jam_rawat', 'suhu_tubuh', 'tensi', 'nadi', 'respirasi', 'tinggi', 'berat', 'spo2', 'gcs', 'kesadaran', 'keluhan', 'pemeriksaan', 'rtl', 'penilaian', 'instruksi', 'evaluasi', 'nip']
      }
    },
    required_fields: ['no_rawat', 'status_rawat', 'original_date', 'original_time'],
    example_request: {
      no_rawat: '2024/01/01/000001',
      status_rawat: 'Ralan',
      original_date: '2024-01-01',
      original_time: '08:00:00',
      tgl_perawatan: '2024-01-01',
      jam_rawat: '08:30:00',
      suhu: '36.5',
      tensi: '120/80',
      nadi: '80',
      respirasi: '20'
    }
  });
});

// PUT /api/update-examination - Update examination data
router.put('/', async (req, res) => {
  console.log('🔄 PUT /api/update-examination endpoint called!');
  
  try {
    const {
      no_rawat,
      status_rawat,
      original_date,
      original_time,
      tgl_perawatan,
      jam_rawat,
      suhu,
      tensi,
      nadi,
      respirasi,
      tinggi,
      berat,
      spo2,
      gcs,
      kesadaran,
      keluhan,
      pemeriksaan,
      rtl,
      penilaian,
      instruksi,
      evaluasi,
      nip
    } = req.body;

    console.log('📝 Update examination request:', {
      no_rawat,
      status_rawat,
      original_date,
      original_time,
      tgl_perawatan,
      jam_rawat
    });

    const result = await updateExaminationData({
      no_rawat,
      status_rawat,
      original_date,
      original_time,
      tgl_perawatan,
      jam_rawat,
      suhu,
      tensi,
      nadi,
      respirasi,
      tinggi,
      berat,
      spo2,
      gcs,
      kesadaran,
      keluhan,
      pemeriksaan,
      rtl,
      penilaian,
      instruksi,
      evaluasi,
      nip
    });

    console.log('✅ Examination updated successfully');
    
    res.json({
      success: true,
      message: 'Examination updated successfully',
      table: status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap',
      data: result
    });

  } catch (error) {
    console.error('❌ Error updating examination:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: error.message
    });
  }
});

export default router;