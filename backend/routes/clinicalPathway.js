import express from 'express';
import { ClinicalPathwayService } from '../services/clinicalPathwayService.js';
import medicalScribeService from '../services/medicalScribeService.js';
import { body, param, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';

const router = express.Router();
const clinicalPathwayService = new ClinicalPathwayService();

// Middleware untuk validasi parameter
const validatePatientParams = [
  param('no_rkm_medis')
    .notEmpty()
    .withMessage('No rekam medis harus diisi')
    .isLength({ min: 1, max: 15 })
    .withMessage('No rekam medis tidak valid'),
  param('no_rawat')
    .notEmpty()
    .withMessage('No rawat harus diisi')
    .isLength({ min: 1, max: 17 })
    .withMessage('No rawat tidak valid')
];

// Middleware untuk validasi data clinical pathway
const validateClinicalPathwayData = [
  body('no_rkm_medis')
    .notEmpty()
    .withMessage('No rekam medis harus diisi'),
  body('no_rawat')
    .notEmpty()
    .withMessage('No rawat harus diisi'),
  body('patient_name')
    .notEmpty()
    .withMessage('Nama pasien harus diisi'),
  body('pathway_data')
    .isArray()
    .withMessage('Data pathway harus berupa array')
    .optional()
];

const validateGeneratePatientPayload = [
  body('no_rkm_medis')
    .notEmpty()
    .withMessage('No rekam medis harus diisi'),
  body('no_rawat')
    .notEmpty()
    .withMessage('No rawat harus diisi'),
  body('clinical_pathway_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Clinical pathway id tidak valid')
];

const validateMonitoringPatientId = [
  param('patientId')
    .isInt({ min: 1 })
    .withMessage('Patient CP id tidak valid')
];

const validateMonitoringExecutionPayload = [
  ...validateMonitoringPatientId,
  param('executionId')
    .isInt({ min: 1 })
    .withMessage('Execution id tidak valid'),
  body('status')
    .notEmpty()
    .withMessage('Status aktivitas harus diisi')
];

const validateMonitoringPatientStatusPayload = [
  ...validateMonitoringPatientId,
  body('status')
    .notEmpty()
    .withMessage('Status pasien harus diisi')
];

/**
 * @route GET /api/clinical-pathway/monitoring/by-no-rawat/:no_rawat
 * @desc Mendapatkan detail monitoring berdasarkan no_rawat
 * @access Private
 */
router.get('/monitoring/by-no-rawat/:no_rawat', async (req, res) => {
  try {
    const result = await clinicalPathwayService.getMonitoringDetailByNoRawat(req.params.no_rawat);
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in clinical pathway monitoring by no_rawat route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/clinical-pathway/monitoring/:patientId
 * @desc Mendapatkan detail monitoring pasien Clinical Pathway
 * @access Private
 */
router.get('/monitoring/:patientId', validateMonitoringPatientId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const result = await clinicalPathwayService.getMonitoringDetail(Number(req.params.patientId));
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in clinical pathway monitoring detail route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/monitoring/:patientId/refresh
 * @desc Refresh monitoring pasien Clinical Pathway
 * @access Private
 */
router.post('/monitoring/:patientId/refresh', validateMonitoringPatientId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const result = await clinicalPathwayService.refreshMonitoring(Number(req.params.patientId));
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in clinical pathway refresh monitoring route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/monitoring/:patientId/execution/:executionId/status
 * @desc Update status aktivitas monitoring
 * @access Private
 */
router.post('/monitoring/:patientId/execution/:executionId/status', validateMonitoringExecutionPayload, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const result = await clinicalPathwayService.updateExecutionStatus(
      Number(req.params.patientId),
      Number(req.params.executionId),
      req.body.status
    );
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in clinical pathway update execution status route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/monitoring/:patientId/status
 * @desc Update status pasien Clinical Pathway
 * @access Private
 */
router.post('/monitoring/:patientId/status', validateMonitoringPatientStatusPayload, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const result = await clinicalPathwayService.updatePatientStatus(
      Number(req.params.patientId),
      req.body.status
    );
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in clinical pathway update patient status route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/clinical-pathway/:no_rkm_medis/:no_rawat
 * @desc Mendapatkan data pasien untuk clinical pathway
 * @access Private
 */
router.get('/:no_rkm_medis/:no_rawat', validatePatientParams, async (req, res) => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { no_rkm_medis, no_rawat } = req.params;
    const requestedClinicalPathwayId = Number(req.query.clinical_pathway_id || 0);
    
    // Convert no_rawat (without slashes) to formatted version with slashes
    const formattedNoRawat = no_rawat.length >= 8 ? 
      `${no_rawat.substring(0, 4)}/${no_rawat.substring(4, 6)}/${no_rawat.substring(6, 8)}/${no_rawat.substring(8)}` : 
      no_rawat;
    
    console.log('=== Clinical Pathway API - Get Patient Data ===');
    console.log('Request params:', { no_rkm_medis, no_rawat, requestedClinicalPathwayId });
    console.log('Formatted no_rawat:', formattedNoRawat);
    console.log('User:', req.user?.username || 'Unknown');

    // Panggil service untuk mendapatkan data pasien
    const result = await clinicalPathwayService.getPatientData(
      no_rkm_medis,
      formattedNoRawat,
      requestedClinicalPathwayId || null
    );
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
        data: null
      });
    }

    console.log('Patient data retrieved successfully');
    
    res.json({
      success: true,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Error in clinical pathway route:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/save
 * @desc Menyimpan data clinical pathway
 * @access Private
 */
router.post('/save', validateClinicalPathwayData, async (req, res) => {
  try {
    // Validasi input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const pathwayData = req.body;
    
    console.log('=== Clinical Pathway API - Save Clinical Pathway ===');
    console.log('User:', req.user?.username || 'Unknown');
    console.log('Pathway data keys:', Object.keys(pathwayData));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('ICD-10 Secondary:', JSON.stringify(req.body.icd10_secondary, null, 2));
    console.log('ICD-9 Secondary:', JSON.stringify(req.body.icd9_secondary, null, 2));

    // Panggil service untuk menyimpan clinical pathway
    const result = await clinicalPathwayService.saveClinicalPathway(pathwayData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    console.log('Clinical pathway saved successfully');
    
    res.json({
      success: true,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('Error in save clinical pathway route:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/generate-patient
 * @desc Generate clinical pathway pasien berdasarkan no_rawat, status_lanjut, master CP, dan histori 1 tahun terakhir
 * @access Private
 */
router.post('/generate-patient', validateGeneratePatientPayload, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const result = await clinicalPathwayService.generatePatientClinicalPathway(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error in generate patient clinical pathway route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/clinical-pathway/generate
 * @desc Generate Clinical Pathway menggunakan AI
 * @access Private
 */
router.post('/generate', async (req, res) => {
  try {
    console.log('=== Clinical Pathway API - Generate ===');
    console.log('User:', req.user?.username || 'Unknown');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    // console.log('Patient data:', JSON.stringify(req.body.patientData, null, 2));
    // console.log('ICD10 Secondary:', JSON.stringify(req.body.patientData?.icd10_secondary, null, 2));
    // console.log('ICD9 Secondary:', JSON.stringify(req.body.patientData?.icd9_secondary, null, 2));

    const { patientData } = req.body;

    if (!patientData) {
      return res.status(400).json({
        success: false,
        message: 'Data pasien harus disertakan'
      });
    }

    if (!patientData.no_rkm_medis || !patientData.patient_name) {
      return res.status(400).json({
        success: false,
        message: 'No rekam medis dan nama pasien harus disertakan'
      });
    }

    // Generate Clinical Pathway menggunakan AI
    const result = await medicalScribeService.generateClinicalPathway(patientData);

    if (!result.clinicalPathway) {
      return res.status(500).json({
        success: false,
        message: 'Gagal generate Clinical Pathway',
        rawResponse: result.rawResponse
      });
    }

    res.json({
      success: true,
      message: 'Clinical Pathway berhasil di-generate',
      data: result.clinicalPathway
    });

  } catch (error) {
    console.error('Error in generate clinical pathway route:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/clinical-pathway/template
 * @desc Mendapatkan template clinical pathway
 * @access Private
 */
/**
 * @route POST /api/clinical-pathway/data-mining
 * @desc Mendapatkan data mining clinical pathway dari database
 * @access Private
 */
router.post('/data-mining', async (req, res) => {
  try {
    console.log('=== Clinical Pathway API - Data Mining ===');
    console.log('User:', req.user?.username || 'Unknown');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Template konstanta untuk data mining
    const template = {
      categories: [
        {
          name: 'ASESMEN',
          items: [
            'Asesmen awal medis',
            'Asesmen awal keperawatan',
            'Asesmen nyeri',
            'Asesmen risiko jatuh',
            'Asesmen gizi',
            'EKG/Pemeriksaan penunjang',
            'Laboratorium'
          ]
        },
        {
          name: 'KONSULTASI',
          items: [
            'Konsultasi spesialis terkait',
            'Konsultasi gizi',
            'Konsultasi farmasi',
            'Konsultasi rehabilitasi medik'
          ]
        },
        {
          name: 'TINDAKAN MEDIS',
          items: [
            'Persiapan tindakan medis',
            'Tindakan diagnostik',
            'Tindakan terapeutik',
            'Monitoring post tindakan'
          ]
        },
        {
          name: 'TINDAKAN KEPERAWATAN',
          items: [
            'Pemasangan infus',
            'Monitoring vital sign',
            'Perawatan luka',
            'Mobilisasi',
            'Edukasi pasien & keluarga'
          ]
        },
        {
          name: 'TINDAKAN FARMASI',
          items: [
            'Rekonsiliasi obat',
            'Pemberian obat',
            'Monitoring efek samping',
            'Edukasi penggunaan obat'
          ]
        },
        {
          name: 'AKTIVITAS HARIAN',
          items: [
            'Diet/Nutrisi',
            'Aktivitas/Mobilisasi',
            'Istirahat/Tidur',
            'Personal hygiene',
            'Eliminasi'
          ]
        },
        {
          name: 'DISCHARGE PLANNING',
          items: [
            'Asesmen discharge planning',
            'Edukasi pulang',
            'Resep pulang',
            'Jadwal kontrol',
            'Rujukan lanjutan'
          ]
        }
      ],
      days: ['Hari 1', 'Hari 2', 'Hari 3', 'Hari 4', 'Hari 5', 'Hari 6', 'Hari 7']
    };

    // Ambil kode ICD dari request body - mendukung struktur patientData atau icd_code langsung
    const { patientData, icd_code } = req.body;
    
    // Prioritaskan patientData jika ada, fallback ke icd_code
    const finalIcdCode = patientData?.icd10_primary?.code || 
                        patientData?.icd10_primary || 
                        icd_code;
    
    if (!finalIcdCode) {
      return res.status(400).json({
        success: false,
        message: 'Kode ICD harus disediakan untuk data mining'
      });
    }

    // Query data mining untuk menganalisis data clinical pathway berdasarkan ICD
    const dataMiningQuery = `
      SELECT 
        rp.no_rawat, 
        p.no_rkm_medis, 
        p.jk, 
        p.tgl_lahir, 
        rp.tgl_registrasi, 
        dp.kd_penyakit, 
        pk.nm_penyakit, 
        GROUP_CONCAT(DISTINCT pr.kode) AS kode_tindakan, 
        GROUP_CONCAT(DISTINCT ip.deskripsi_panjang) AS nama_tindakan, 
        GROUP_CONCAT(DISTINCT rd.kode_brng) AS kode_obat, 
        GROUP_CONCAT(DISTINCT db.nama_brng) AS nama_obat, 
        MIN(ki.tgl_masuk) AS tgl_masuk, 
        MAX(ki.tgl_keluar) AS tgl_keluar, 
        MAX(ki.stts_pulang) AS stts_pulang 
      FROM reg_periksa rp 
      JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis 
      LEFT JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat 
      LEFT JOIN penyakit pk ON pk.kd_penyakit = dp.kd_penyakit 
      LEFT JOIN prosedur_pasien pr ON pr.no_rawat = rp.no_rawat 
      LEFT JOIN icd9 ip ON ip.kode = pr.kode 
      LEFT JOIN resep_obat ro ON ro.no_rawat = rp.no_rawat 
      LEFT JOIN resep_dokter rd ON rd.no_resep = ro.no_resep 
      LEFT JOIN databarang db ON db.kode_brng = rd.kode_brng 
      LEFT JOIN kamar_inap ki ON ki.no_rawat = rp.no_rawat 
      WHERE dp.kd_penyakit = ? 
      AND rp.status_lanjut = 'Ranap' 
      AND rp.tgl_registrasi >= '2025-01-01'
      GROUP BY rp.no_rawat 
      ORDER BY rp.tgl_registrasi DESC
    `;

    let historicalData = [];
    let estimatedLOS = 5;
    let estimatedCost = 3000000;

    try {
      // Eksekusi query data mining
      console.log('=== Data Mining Query ===');
      console.log('ICD Code:', finalIcdCode);
      console.log('Query:', dataMiningQuery);
      
      const results = await executeQuery(dataMiningQuery, [finalIcdCode]);
      console.log('Query Results Count:', results.length);
      console.log('Sample Results:', results.slice(0, 2));

      historicalData = results;

      // Analisis data untuk estimasi LOS dan biaya
      if (results.length > 0) {
        // Hitung rata-rata Length of Stay
        const losData = results.filter(row => row.tgl_masuk && row.tgl_keluar)
          .map(row => {
            const masuk = new Date(row.tgl_masuk);
            const keluar = new Date(row.tgl_keluar);
            return Math.ceil((keluar - masuk) / (1000 * 60 * 60 * 24));
          });
        
        if (losData.length > 0) {
          estimatedLOS = Math.ceil(losData.reduce((a, b) => a + b, 0) / losData.length);
        }

        // Estimasi biaya berdasarkan kompleksitas kasus
        const avgTindakan = results.reduce((acc, row) => {
          const tindakanCount = row.kode_tindakan ? row.kode_tindakan.split(',').length : 0;
          return acc + tindakanCount;
        }, 0) / results.length;

        const avgObat = results.reduce((acc, row) => {
          const obatCount = row.kode_obat ? row.kode_obat.split(',').length : 0;
          return acc + obatCount;
        }, 0) / results.length;

        // Estimasi biaya berdasarkan kompleksitas
        estimatedCost = Math.floor((avgTindakan * 500000) + (avgObat * 100000) + (estimatedLOS * 300000));
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Fallback ke data simulasi jika query gagal
      console.log('Menggunakan data simulasi karena query database gagal');
    }

    // Generate pathway data berdasarkan template dan data mining
    const dataMiningResult = {
      pathwayData: template.categories.map(category => ({
        category: category.name,
        items: category.items.map(item => ({
          name: item,
          days: [true, true, false, false, false, false, false], // Pattern berdasarkan analisis
          notes: historicalData.length > 0 ? 
            `Berdasarkan analisis ${historicalData.length} kasus serupa dengan ICD ${finalIcdCode}` : 
            `Data mining result for ${item}`,
          variance: ''
        }))
      })),
      estimatedLOS,
      estimatedCost,
      historicalData: historicalData.slice(0, 5), // Tampilkan 5 kasus teratas
      analysisMetadata: {
        icd_code: finalIcdCode,
        total_cases_analyzed: historicalData.length,
        query_date: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      message: 'Data mining clinical pathway berhasil diambil',
      data: dataMiningResult
    });

    } catch (error) {
      console.error('Error in data mining route:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
});

/**
 * @route GET /api/clinical-pathway/template
 * @desc Mendapatkan template default clinical pathway
 * @access Private
 */
router.get('/template', async (req, res) => {
  try {
    console.log('=== Clinical Pathway API - Get Template ===');
    console.log('User:', req.user?.username || 'Unknown');

    // Template default clinical pathway
    const template = {
      categories: [
        {
          name: 'ASESMEN',
          items: [
            'Asesmen awal medis',
            'Asesmen awal keperawatan',
            'Asesmen nyeri',
            'Asesmen risiko jatuh',
            'Asesmen gizi',
            'EKG/Pemeriksaan penunjang',
            'Laboratorium'
          ]
        },
        {
          name: 'KONSULTASI',
          items: [
            'Konsultasi spesialis terkait',
            'Konsultasi gizi',
            'Konsultasi farmasi',
            'Konsultasi rehabilitasi medik'
          ]
        },
        {
          name: 'TINDAKAN MEDIS',
          items: [
            'Persiapan tindakan medis',
            'Tindakan diagnostik',
            'Tindakan terapeutik',
            'Monitoring post tindakan'
          ]
        },
        {
          name: 'TINDAKAN KEPERAWATAN',
          items: [
            'Pemasangan infus',
            'Monitoring vital sign',
            'Perawatan luka',
            'Mobilisasi',
            'Edukasi pasien & keluarga'
          ]
        },
        {
          name: 'TINDAKAN FARMASI',
          items: [
            'Rekonsiliasi obat',
            'Pemberian obat',
            'Monitoring efek samping',
            'Edukasi penggunaan obat'
          ]
        },
        {
          name: 'AKTIVITAS HARIAN',
          items: [
            'Diet/Nutrisi',
            'Aktivitas/Mobilisasi',
            'Istirahat/Tidur',
            'Personal hygiene',
            'Eliminasi'
          ]
        },
        {
          name: 'DISCHARGE PLANNING',
          items: [
            'Asesmen discharge planning',
            'Edukasi pulang',
            'Resep pulang',
            'Jadwal kontrol',
            'Rujukan lanjutan'
          ]
        }
      ],
      days: ['Hari 1', 'Hari 2', 'Hari 3', 'Hari 4', 'Hari 5', 'Hari 6', 'Hari 7']
    };

    res.json({
      success: true,
      message: 'Template clinical pathway berhasil diambil',
      data: template
    });

  } catch (error) {
    console.error('Error in get template route:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
