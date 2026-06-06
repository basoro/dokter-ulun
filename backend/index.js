import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { AuthService } from './services/authService.js';
import { DashboardService } from './services/dashboardService.js';
import { AttendanceService } from './services/attendanceService.js';
import { BookingOperasiService } from './services/bookingOperasiService.js';
import { BookingRegistrasiService } from './services/bookingRegistrasiService.js';
import RawatJalanPatientsService from './services/rawatJalanPatientsService.js';
import RawatInapDataService from './services/rawatInapDataService.js';
import HemodialisaDataService from './services/hemodialisaDataService.js';
import GetMedicalRecordService from './services/getMedicalRecordService.js';
import DeleteExaminationService from './services/deleteExaminationService.js';
import IcdDataService from './services/icdDataService.js';
import IgdDataService from './services/igdDataService.js';
import LaboratoryDataService from './services/laboratoryDataService.js';
import MedicalScribeService from './services/medicalScribeService.js';
import PrescriptionDataService from './services/prescriptionDataService.js';
import ResumePasienDataService from './services/resumePasienDataService.js';
import SaveExaminationService from './services/saveExaminationService.js';
import WhatsappOtpService from './services/whatsappOtpService.js';
import statisticsDataRoutes from './routes/statisticsData.js';
import updateExaminationRoute from './routes/updateExamination.js';
import clinicalPathwayRoutes from './routes/clinicalPathway.js';

import { testConnection } from './config/database.js';

// Load environment variables
dotenv.config();

// #region debug-point A:save-exam-route-reporter
const reportSaveExaminationDebug = (hypothesisId, location, msg, data = {}, runId = 'pre-fix') => {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'save-pemeriksaan';
  try {
    const envContent = fs.readFileSync('.dbg/save-pemeriksaan.env', 'utf8');
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId,
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now()
    })
  }).catch(() => {});
};
// #endregion

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173', // Common Vite port
    'http://127.0.0.1:8081'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global request logging
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dokter Ulun API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Register clinical pathway routes early to avoid conflicts
console.log('🏥 Registering clinical-pathway routes at /api/clinical-pathway');
app.use('/api/clinical-pathway', clinicalPathwayRoutes);
console.log('✅ Clinical-pathway routes registered successfully');

// Save Examination endpoints
app.post('/api/save-examination', async (req, res) => {
  try {
    const examinationData = req.body;
    // #region debug-point A:save-exam-route-entry
    reportSaveExaminationDebug('A', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route hit', {
      method: req.method,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
      no_rawat: examinationData?.no_rawat || null,
      status_rawat: examinationData?.status_rawat || null,
      tgl_perawatan: examinationData?.tgl_perawatan || null,
      jam_rawat: examinationData?.jam_rawat || null,
      nip: examinationData?.nip || null
    });
    // #endregion
    
    const result = await SaveExaminationService.saveExamination(examinationData);
    // #region debug-point A:save-exam-route-success
    reportSaveExaminationDebug('A', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route success', {
      success: result?.success ?? null,
      table: result?.table || null,
      action: result?.data?.action || null
    });
    // #endregion
    res.json(result);
  } catch (error) {
    // #region debug-point D:save-exam-route-error
    reportSaveExaminationDebug('D', 'backend/index.js:/api/save-examination', '[DEBUG] save examination route error', {
      name: error?.name || 'Error',
      message: error?.message || 'Unknown error',
      stack: error?.stack || null
    });
    // #endregion
    console.error('Save examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/examination/:no_rawat/:tgl_perawatan/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, tgl_perawatan, status_rawat } = req.params;
    
    if (!no_rawat || !tgl_perawatan || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat, tgl_perawatan, and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.getExamination(no_rawat, tgl_perawatan, status_rawat);
    res.json(result);
  } catch (error) {
    console.error('Get examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/examination-history/:no_rawat/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, status_rawat } = req.params;
    const { limit = 10 } = req.query;
    
    if (!no_rawat || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.getExaminationHistory(no_rawat, status_rawat, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('Get examination history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/examination/:no_rawat/:tgl_perawatan/:jam_rawat/:status_rawat', async (req, res) => {
  try {
    const { no_rawat, tgl_perawatan, jam_rawat, status_rawat } = req.params;
    
    if (!no_rawat || !tgl_perawatan || !jam_rawat || !status_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat, tgl_perawatan, jam_rawat, and status_rawat are required'
      });
    }

    const result = await SaveExaminationService.deleteExamination(no_rawat, tgl_perawatan, jam_rawat, status_rawat);
    res.json(result);
  } catch (error) {
    console.error('Delete examination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API test endpoint working',
    port: PORT
  });
});

// Login endpoint (simplified)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Simple validation
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }
  
  try {
    // Use real database authentication
    const user = await AuthService.authenticateUser(username, password);
    
    // Generate token (in production, use JWT)
    const token = `backend_token_${Date.now()}_${username}`;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: user,
      token: token
    });
    
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

// WhatsApp OTP Service imported at top

// WhatsApp OTP endpoints
app.post('/api/auth/send-otp', async (req, res) => {
  const { phoneNumber, username } = req.body;
  
  if (!phoneNumber || !username) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and username are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.sendOTP(phoneNumber, username);
    res.json(result);
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP',
      details: error.message
    });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { phoneNumber, username, otp } = req.body;
  
  if (!phoneNumber || !username || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Phone number, username, and OTP are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.verifyOTP(phoneNumber, username, otp);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP',
      details: error.message
    });
  }
});

// Dashboard data endpoint
app.post('/api/dashboard-data', async (req, res) => {
  const { username, kd_poli } = req.body;
  
  // Simple validation
  if (!username) {
    return res.status(400).json({
      success: false,
      error: 'Username is required'
    });
  }
  
  try {
    console.log('Dashboard data request:', { username, kd_poli });
    
    // Get dashboard data from database
    const dashboardData = await DashboardService.getDashboardData(username, kd_poli);
    
    res.json(dashboardData);
    
  } catch (error) {
    console.error('Dashboard data error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve dashboard data'
    });
  }
});

// Attendance data endpoint
app.post('/api/attendance-data', async (req, res) => {
  try {
    const { username, action, date, limit = 30, selectedShift, month } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'username (nik pegawai) is required' });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }
    
    const result = await AttendanceService.getAttendanceData(username, action, {
      date,
      limit,
      selectedShift,
      month
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Attendance data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process attendance request' 
    });
  }
});

// Booking operasi data endpoint
app.post('/api/booking-operasi-data', async (req, res) => {
  const { page, itemsPerPage, search, startDate, endDate, status } = req.body;
  
  try {
    const result = await BookingOperasiService.getBookingOperasiData({
      page,
      itemsPerPage,
      search,
      startDate,
      endDate,
      status
    });
    
    res.json(result);
  } catch (error) {
    console.error('Booking operasi data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Booking Registrasi endpoint
app.post('/api/booking-registrasi', async (req, res) => {
  try {
    const { action, startDate, endDate, status, kd_dokter, no_rkm_medis, tanggal_periksa, data, page, itemsPerPage } = req.body;
    
    let result;
    
    switch (action) {
      case 'getDoctors':
        result = await BookingRegistrasiService.getDoctors();
        break;
        
      case 'getAll':
        result = await BookingRegistrasiService.getAll({
          startDate,
          endDate,
          status,
          kd_dokter,
          page,
          itemsPerPage
        });
        break;
        
      case 'getById':
        result = await BookingRegistrasiService.getById(no_rkm_medis, tanggal_periksa);
        break;
        
      case 'create':
        result = await BookingRegistrasiService.create(data);
        break;
        
      case 'update':
        result = await BookingRegistrasiService.update(no_rkm_medis, tanggal_periksa, data);
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in booking-registrasi endpoint:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Rawat Jalan Patients endpoint
app.post('/api/rawat-jalan-patients', async (req, res) => {
  try {
    const result = await RawatJalanPatientsService.getRawatJalanPatients(req.body);
    res.json(result);
  } catch (error) {
    console.error('Rawat jalan patients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rawat Inap Data endpoint
app.post('/api/rawat-inap-data', async (req, res) => {
  try {
    const result = await RawatInapDataService.getRawatInapData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Rawat inap data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rawat inap data'
    });
  }
});

// Hemodialisa Data endpoint
app.post('/api/hemodialisa-data', async (req, res) => {
  try {
    const result = await HemodialisaDataService.getHemodialisaData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in hemodialisa-data endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get Medical Record endpoint
app.post('/api/get-medical-record', async (req, res) => {
  try {
    const {
      no_rm,
      limit,
      outpatientPage,
      inpatientPage,
      focus_no_rawat
    } = req.body;

    const result = await GetMedicalRecordService.getMedicalRecord(no_rm, {
      limit,
      outpatientPage,
      inpatientPage,
      focusNoRawat: focus_no_rawat
    });

    res.json(result);
  } catch (error) {
    console.error('Error in get-medical-record endpoint:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Delete examination endpoint
app.post('/api/delete-examination', async (req, res) => {
  try {
    const { no_rawat, status_rawat, tgl_perawatan, jam_rawat } = req.body;
    const data = await DeleteExaminationService.deleteExamination(no_rawat, status_rawat, tgl_perawatan, jam_rawat);
    res.json(data);
  } catch (error) {
    console.error('Delete examination error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ICD data endpoint
app.post('/api/icd-data', async (req, res) => {
  try {
    const { page, itemsPerPage, search, icdType } = req.body;
    const data = await IcdDataService.getIcdData(page, itemsPerPage, search, icdType);
    res.json(data);
  } catch (error) {
    console.error('ICD data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// IGD Data endpoint
app.get('/api/igd-data', async (req, res) => {
  try {
    const { 
      page = 1, 
      itemsPerPage = 10, 
      search = '', 
      status = '', 
      triase_level = '', 
      date_from = '', 
      date_to = '', 
      tab = 'triase' 
    } = req.query;
    
    const result = await IgdDataService.getIgdData(
      page, 
      itemsPerPage, 
      search, 
      status, 
      triase_level, 
      date_from, 
      date_to, 
      tab
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching IGD data:', error);
    res.status(500).json({ error: 'Failed to fetch IGD data' });
  }
});

// Laboratory Data endpoints
app.get('/api/laboratory-data', async (req, res) => {
  try {
    const { action, no_rawat, noorder, kd_jenis_prw } = req.query;
    
    let result;
    
    switch (action) {
      case 'get_lab_requests':
        if (!no_rawat) {
          return res.status(400).json({ error: 'no_rawat is required' });
        }
        result = await LaboratoryDataService.getLabRequests(no_rawat);
        break;
        
      case 'get_lab_request_details':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await LaboratoryDataService.getLabRequestDetails(noorder);
        break;
        
      case 'get_lab_services':
        result = await LaboratoryDataService.getLabServices();
        break;
        
      case 'get_lab_templates':
        if (!kd_jenis_prw) {
          return res.status(400).json({ error: 'kd_jenis_prw is required' });
        }
        result = await LaboratoryDataService.getLabTemplates(kd_jenis_prw);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Laboratory data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/laboratory-data', async (req, res) => {
  try {
    const { action } = req.query;
    const { no_rawat, dokter_perujuk, examinations, details, noorder } = req.body;
    
    let result;
    
    switch (action) {
      case 'create_lab_request':
        if (!no_rawat || !dokter_perujuk) {
          return res.status(400).json({ error: 'no_rawat and dokter_perujuk are required' });
        }
        result = await LaboratoryDataService.createLabRequest(no_rawat, dokter_perujuk, examinations, details);
        break;
        
      case 'update_lab_request':
        if (!noorder) {
          return res.status(400).json({ error: 'noorder is required' });
        }
        result = await LaboratoryDataService.updateLabRequest(noorder, examinations, details);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Laboratory data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/laboratory-data', async (req, res) => {
  try {
    const { action, noorder } = req.query;
    
    if (action === 'delete_lab_request') {
      if (!noorder) {
        return res.status(400).json({ error: 'noorder is required' });
      }
      
      const result = await LaboratoryDataService.deleteLabRequest(noorder);
      res.json(result);
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Laboratory data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Medical Scribe endpoint
app.post('/api/medical-scribe', async (req, res) => {
  try {
    const { text, no_rkm_medis, patient_name } = req.body;
    
    if (!text || !no_rkm_medis || !patient_name) {
      return res.status(400).json({ 
        error: 'Missing required parameters: text, no_rkm_medis, and patient_name are required' 
      });
    }
    
    const result = await MedicalScribeService.generateMedicalSuggestion(text, no_rkm_medis, patient_name);
    
    res.json(result);
  } catch (error) {
    console.error('Medical scribe error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Prescription Data endpoints
app.get('/api/prescription-data', async (req, res) => {
  try {
    const { action, no_rawat, no_resep } = req.query;
    
    let result;
    
    switch (action) {
      case 'get_prescriptions':
        if (!no_rawat) {
          return res.status(400).json({
            success: false,
            error: 'no_rawat is required for get_prescriptions'
          });
        }
        result = await PrescriptionDataService.getPrescriptions(no_rawat);
        break;
        
      case 'get_prescription_details':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for get_prescription_details'
          });
        }
        result = await PrescriptionDataService.getPrescriptionDetails(no_resep);
        break;
        
      case 'get_medicines':
        result = await PrescriptionDataService.getMedicines();
        break;
        
      case 'get_compound_methods':
        result = await PrescriptionDataService.getCompoundMethods();
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: get_prescriptions, get_prescription_details, get_medicines, get_compound_methods'
        });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Prescription data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/prescription-data', async (req, res) => {
  try {
    const { action, no_rawat, kd_dokter, no_resep, medicines, compounds } = req.body;
    
    let result;
    
    switch (action) {
      case 'create_prescription':
        if (!no_rawat || !kd_dokter) {
          return res.status(400).json({
            success: false,
            error: 'no_rawat and kd_dokter are required for create_prescription'
          });
        }
        result = await PrescriptionDataService.createPrescription(no_rawat, kd_dokter, medicines, compounds);
        break;
        
      case 'update_prescription':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for update_prescription'
          });
        }
        result = await PrescriptionDataService.updatePrescription(no_resep, medicines, compounds);
        break;
        
      case 'delete_prescription':
        if (!no_resep) {
          return res.status(400).json({
            success: false,
            error: 'no_resep is required for delete_prescription'
          });
        }
        result = await PrescriptionDataService.deletePrescription(no_resep);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported actions: create_prescription, update_prescription, delete_prescription'
        });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Prescription data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume Pasien Data endpoints
app.post('/api/resume-pasien-data', async (req, res) => {
  try {
    const {
      page = "1",
      itemsPerPage = "50", 
      search = "",
      statusPulang = "all",
      startDate,
      endDate
    } = req.body;

    const result = await ResumePasienDataService.getResumePasienData({
      page,
      itemsPerPage,
      search,
      statusPulang,
      startDate,
      endDate
    });

    res.json(result);
  } catch (error) {
    console.error('Resume pasien data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.getResumeDetail(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Resume detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    const resumeData = req.body;
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.saveResume(no_rawat, resumeData);
    res.json(result);
  } catch (error) {
    console.error('Save resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/resume-pasien-data/:no_rawat', async (req, res) => {
  try {
    const { no_rawat } = req.params;
    
    if (!no_rawat) {
      return res.status(400).json({
        success: false,
        error: 'no_rawat is required'
      });
    }

    const result = await ResumePasienDataService.deleteResume(no_rawat);
    res.json(result);
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register routes
console.log('📊 Registering statistics-data routes at /api/statistics-data');
app.use('/api/statistics-data', statisticsDataRoutes);
console.log('✅ Statistics-data routes registered successfully');

// Register update examination routes
console.log('📝 Registering update-examination routes at /api/update-examination');
app.use('/api/update-examination', updateExaminationRoute);
console.log('✅ Update-examination routes registered successfully');

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Dokter Ulun API Server`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  // Test database connection
  console.log('🔍 Testing database connection...');
  try {
    await testConnection();
  } catch (error) {
    console.error('⚠️ Database connection test failed, but server will continue:', error.message);
  }
});

export default app;
