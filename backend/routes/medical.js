import express from 'express';
import { MedicalService } from '../services/medicalService.js';
import { validateMedicalRecord, validatePatientData } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get medical record
router.post('/medical-record', validateMedicalRecord, asyncHandler(async (req, res) => {
  const { no_rkm_medis, no_rawat } = req.body;
  
  try {
    const medicalRecord = await MedicalService.getMedicalRecord(no_rkm_medis, no_rawat);
    
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        error: 'Medical record not found'
      });
    }
    
    res.json({
      success: true,
      data: medicalRecord
    });
    
  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get medical record'
    });
  }
}));

// Get rawat jalan patients
router.post('/rawat-jalan-patients', validatePatientData, asyncHandler(async (req, res) => {
  const filters = {
    kd_poli: req.body.kd_poli,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    status: req.body.status || 'all',
    statusBayar: req.body.statusBayar || 'all',
    tabFilter: req.body.tabFilter || 'hari-ini',
    page: parseInt(req.body.page) || 1,
    itemsPerPage: parseInt(req.body.itemsPerPage) || 10
  };
  
  try {
    const result = await MedicalService.getRawatJalanPatients(filters);
    
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      itemsPerPage: result.itemsPerPage,
      totalPages: result.totalPages
    });
    
  } catch (error) {
    console.error('Get rawat jalan patients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rawat jalan patients'
    });
  }
}));

// Search patients
router.get('/search-patients', asyncHandler(async (req, res) => {
  const { q: searchQuery, limit = 10 } = req.query;
  
  if (!searchQuery || searchQuery.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters long'
    });
  }
  
  try {
    const patients = await MedicalService.searchPatients(searchQuery.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: patients,
      count: patients.length
    });
    
  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search patients'
    });
  }
}));

// Get outpatient visits for a patient
router.get('/outpatient-visits/:no_rkm_medis', asyncHandler(async (req, res) => {
  const { no_rkm_medis } = req.params;
  
  if (!no_rkm_medis) {
    return res.status(400).json({
      success: false,
      error: 'Medical record number is required'
    });
  }
  
  try {
    const visits = await MedicalService.getOutpatientVisits(no_rkm_medis);
    
    res.json({
      success: true,
      data: visits,
      count: visits.length
    });
    
  } catch (error) {
    console.error('Get outpatient visits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get outpatient visits'
    });
  }
}));

// Get inpatient visits for a patient
router.get('/inpatient-visits/:no_rkm_medis', asyncHandler(async (req, res) => {
  const { no_rkm_medis } = req.params;
  
  if (!no_rkm_medis) {
    return res.status(400).json({
      success: false,
      error: 'Medical record number is required'
    });
  }
  
  try {
    const visits = await MedicalService.getInpatientVisits(no_rkm_medis);
    
    res.json({
      success: true,
      data: visits,
      count: visits.length
    });
    
  } catch (error) {
    console.error('Get inpatient visits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inpatient visits'
    });
  }
}));

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Medical service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;