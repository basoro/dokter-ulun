import express from 'express';
import StatisticsDataService from '../services/statisticsDataService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

console.log('📊 Statistics Data router initialized');

// Add middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`📊 Statistics Data route accessed: ${req.method} ${req.path}`);
  next();
});

/**
 * @route POST /statistics-data
 * @desc Get statistics data based on type and parameters
 * @access Public
 */
router.post('/', asyncHandler(async (req, res) => {
  const { statisticType, periodType, startDate, endDate, limit } = req.body;

  // Validate required parameters
  if (!statisticType || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'statisticType, startDate, and endDate are required'
    });
  }

  // Validate statistic type
  const validTypes = ['visits', 'diagnosis', 'doctors', 'summary'];
  if (!validTypes.includes(statisticType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid statisticType. Must be one of: visits, diagnosis, doctors, summary'
    });
  }

  // Validate period type for visits
  if (statisticType === 'visits' && periodType) {
    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(periodType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid periodType. Must be one of: daily, weekly, monthly, yearly'
      });
    }
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD format'
    });
  }

  // Validate date range
  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'startDate cannot be later than endDate'
    });
  }

  try {
    console.log(`Fetching ${statisticType} statistics from ${startDate} to ${endDate}`);
    
    const result = await StatisticsDataService.getStatisticsData(
      statisticType,
      periodType || 'monthly',
      startDate,
      endDate,
      limit || 10
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching statistics data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching statistics data'
    });
  }
}));

/**
 * @route GET /statistics-data/types
 * @desc Get available statistic types and their descriptions
 * @access Public
 */
router.get('/types', (req, res) => {
  console.log('📊 GET /types endpoint called!');
  res.json({
    success: true,
    data: {
      statisticTypes: [
        {
          type: 'visits',
          name: 'Kunjungan Pasien',
          description: 'Statistik kunjungan pasien berdasarkan periode waktu',
          periodTypes: ['daily', 'weekly', 'monthly', 'yearly']
        },
        {
          type: 'diagnosis',
          name: 'Diagnosis',
          description: 'Statistik diagnosis paling sering'
        },
        {
          type: 'doctors',
          name: 'Dokter',
          description: 'Statistik kinerja dokter'
        },
        {
          type: 'summary',
          name: 'Ringkasan',
          description: 'Ringkasan statistik umum'
        }
      ]
    }
  });
});

export default router;