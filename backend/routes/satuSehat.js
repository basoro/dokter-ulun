import express from 'express';
import SatuSehatRmeService from '../services/satuSehatRmeService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { executeQuery } from '../config/database.js';

const router = express.Router();

console.log('🏥 Satu Sehat RME router initialized');

const getSettingsButtonAccess = () => {
  const configuredAccess = String(process.env.SETTINGS_BUTTON_SSRME_ACCESS || '').trim();

  try {
    const parsedAccess = JSON.parse(configuredAccess);
    return Array.isArray(parsedAccess)
      ? parsedAccess.map((username) => String(username).trim()).filter(Boolean)
      : [];
  } catch {
    return configuredAccess.split(',').map((username) => username.trim()).filter(Boolean);
  }
};

const getSettingsAlertKronisAccess = () => {
  const configuredAccess = String(process.env.SETTINGS_ALERT_KRONIS || '').trim();

  try {
    const parsedAccess = JSON.parse(configuredAccess);
    return Array.isArray(parsedAccess)
      ? parsedAccess.map((username) => String(username).trim()).filter(Boolean)
      : [];
  } catch {
    return configuredAccess.split(',').map((username) => username.trim()).filter(Boolean);
  }
};

const getRequestUsername = (req) => String(
  req?.headers?.['x-user-id']
  || req?.headers?.['x-username']
  || req?.body?.username
  || req?.query?.username
  || ''
).trim();

const getSsrmeButtonSetting = async () => {
  const rows = await executeQuery(
    'SELECT value FROM mlite_settings WHERE module = ? AND field = ? LIMIT 1',
    ['satu_sehat', 'ssrme_button']
  );

  return String(rows[0]?.value || '').toLowerCase() === 'on';
};

router.get('/button-setting', asyncHandler(async (req, res) => {
  const username = getRequestUsername(req);
  const enabled = await getSsrmeButtonSetting();

  return res.json({
    success: true,
    enabled,
    can_manage: getSettingsButtonAccess().includes(username)
  });
}));

router.put('/button-setting', asyncHandler(async (req, res) => {
  const username = getRequestUsername(req);
  if (!username || !getSettingsButtonAccess().includes(username)) {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses untuk mengubah pengaturan ini.' });
  }

  const value = String(req.body?.value || '').trim().toLowerCase();
  if (value !== 'on' && value !== 'off') {
    return res.status(400).json({ success: false, message: 'Nilai pengaturan harus on atau off.' });
  }

  const existingRows = await executeQuery(
    'SELECT 1 FROM mlite_settings WHERE module = ? AND field = ? LIMIT 1',
    ['satu_sehat', 'ssrme_button']
  );

  if (existingRows.length) {
    await executeQuery(
      'UPDATE mlite_settings SET value = ? WHERE module = ? AND field = ?',
      [value, 'satu_sehat', 'ssrme_button']
    );
  } else {
    await executeQuery(
      'INSERT INTO mlite_settings (module, field, value) VALUES (?, ?, ?)',
      ['satu_sehat', 'ssrme_button', value]
    );
  }

  return res.json({ success: true, enabled: value === 'on' });
}));

/**
 * @route GET /satu-sehat/alert-kronis-setting
 * @desc Get dokter_setkronis setting value for alert obat kronis per item obat
 * @access Restricted to kd_dokter in SETTINGS_ALERT_KRONIS env
 */
router.get('/alert-kronis-setting', asyncHandler(async (req, res) => {
  const username = getRequestUsername(req);
  const canManage = getSettingsAlertKronisAccess().includes(username);
  const rows = await executeQuery(
    'SELECT value FROM mlite_settings WHERE module = ? AND field = ? LIMIT 1',
    ['settings', 'dokter_setkronis']
  );
  const value = String(rows[0]?.value || 'off').toLowerCase();

  return res.json({
    success: true,
    enabled: value === 'on',
    can_manage: canManage
  });
}));

/**
 * @route PUT /satu-sehat/alert-kronis-setting
 * @desc Set dokter_setkronis setting value (on/off) for alert obat kronis
 * @access Restricted to kd_dokter in SETTINGS_ALERT_KRONIS env
 */
router.put('/alert-kronis-setting', asyncHandler(async (req, res) => {
  const username = getRequestUsername(req);
  if (!username || !getSettingsAlertKronisAccess().includes(username)) {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses untuk mengubah pengaturan ini.' });
  }

  const value = String(req.body?.value || '').trim().toLowerCase();
  if (value !== 'on' && value !== 'off') {
    return res.status(400).json({ success: false, message: 'Nilai pengaturan harus on atau off.' });
  }

  const existingRows = await executeQuery(
    'SELECT 1 FROM mlite_settings WHERE module = ? AND field = ? LIMIT 1',
    ['settings', 'dokter_setkronis']
  );

  if (existingRows.length) {
    await executeQuery(
      'UPDATE mlite_settings SET value = ? WHERE module = ? AND field = ?',
      [value, 'settings', 'dokter_setkronis']
    );
  } else {
    await executeQuery(
      'INSERT INTO mlite_settings (module, field, value) VALUES (?, ?, ?)',
      ['settings', 'dokter_setkronis', value]
    );
  }

  return res.json({ success: true, enabled: value === 'on' });
}));

/**
 * @route POST /satu-sehat/rme-nasional
 * @desc Buka RME Nasional SATUSEHAT (ChaRME) untuk sebuah kunjungan.
 *       Alur: token -> SHL; bila consent belum ada, buat CHL lalu coba lagi.
 * @access Public (dipakai halaman rekam medis pasien)
 */
router.post('/rme-nasional', asyncHandler(async (req, res) => {
  const no_rawat = String(req.body?.no_rawat || '').trim();

  if (!no_rawat) {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'No. rawat wajib diisi.'
    });
  }

  const result = await SatuSehatRmeService.openRmeForVisit(no_rawat);

  return res.json({
    success: result.status === 'success',
    ...result
  });
}));

/**
 * @route GET /satu-sehat/cek-resource/:resourceType/:id
 * @desc Diagnosa: cek apakah Patient/Practitioner ID dikenal server FHIR
 *       SATUSEHAT beserta nama & NIK yang tercatat. Berguna memastikan ID
 *       lokal cocok dengan data produksi saat CHL/SHL gagal.
 * @access Public (dipakai untuk troubleshooting integrasi)
 */
router.get('/cek-resource/:resourceType/:id', asyncHandler(async (req, res) => {
  const { resourceType, id } = req.params;
  const settings = await SatuSehatRmeService.getSettings();
  const result = await SatuSehatRmeService.fetchFhirResource(resourceType, id, settings);

  return res.json({ success: result.found, ...result });
}));

export default router;
