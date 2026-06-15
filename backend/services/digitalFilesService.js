import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// #region debug-point shared:reporter
const reportDigitalFilesDebug = (hypothesisId, location, msg, data = {}, runId = 'pre-fix') => {
  let debugServerUrl = 'http://127.0.0.1:7777/event';
  let debugSessionId = 'digital-files-env';
  try {
    const envContent = fs.readFileSync(path.resolve(process.cwd(), '.dbg/digital-files-env.env'), 'utf8');
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}
  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: debugSessionId, runId, hypothesisId, location, msg, data, ts: Date.now() })
  }).catch(() => {});
};
// #endregion

class DigitalFilesService {
  static MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

  static ALLOWED_UPLOAD_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]);

  static normalizeConfiguredUrl(value) {
    return String(value || '')
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/\/+$/, '');
  }

  static getUploadsBaseUrl() {
    const rawValue = String(process.env.DIGITAL_FILES_BASE_URL || '').trim();
    const normalizedValue = this.normalizeConfiguredUrl(rawValue);
    // #region debug-point C:env-read
    reportDigitalFilesDebug('C', 'digitalFilesService:getUploadsBaseUrl', '[DEBUG] Reading DIGITAL_FILES_BASE_URL from runtime env', {
      cwd: process.cwd(),
      serviceEnvPath: path.resolve(__dirname, '../.env'),
      hasValue: Boolean(rawValue),
      rawValue: rawValue || null,
      normalizedValue: normalizedValue || null
    });
    // #endregion
    return normalizedValue;
  }

  static getUploadApiUrl() {
    const rawValue = String(
      process.env.DIGITAL_FILES_UPLOAD_API_URL || ''
    ).trim();

    return this.normalizeConfiguredUrl(rawValue);
  }

  static getUploadToken() {
    return String(
      process.env.DIGITAL_FILES_UPLOAD_TOKEN || ''
    ).trim();
  }

  static buildFileUrl(lokasiFile) {
    const baseUrl = this.getUploadsBaseUrl();
    const normalizedPath = String(lokasiFile || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    if (!baseUrl || !normalizedPath) {
      return '';
    }

    const encodedPath = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `${baseUrl}/${encodedPath}`;
  }

  static inferMimeType(filePath) {
    const normalizedPath = String(filePath || '').toLowerCase();

    if (normalizedPath.endsWith('.pdf')) return 'application/pdf';
    if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) return 'image/jpeg';
    if (normalizedPath.endsWith('.png')) return 'image/png';
    if (normalizedPath.endsWith('.gif')) return 'image/gif';
    if (normalizedPath.endsWith('.webp')) return 'image/webp';
    if (normalizedPath.endsWith('.doc')) return 'application/msword';
    if (normalizedPath.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    return 'application/octet-stream';
  }

  static extractFileName(filePath) {
    const normalizedPath = String(filePath || '').replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || normalizedPath || '-';
  }

  static async getFileOptions() {
    const rows = await executeQuery(
      `
        SELECT kode, nama
        FROM master_berkas_digital
        ORDER BY nama ASC, kode ASC
      `
    );

    return {
      success: true,
      data: rows.map((row) => ({
        kode: String(row.kode || '').trim(),
        nama: String(row.nama || row.kode || '').trim()
      })).filter((row) => row.kode)
    };
  }

  static async canManageFilesForVisit(noRawat, kdDokter) {
    const normalizedNoRawat = String(noRawat || '').trim();
    const normalizedKdDokter = String(kdDokter || '').trim();

    if (!normalizedNoRawat || !normalizedKdDokter) {
      return false;
    }

    const rows = await executeQuery(
      `
        SELECT COUNT(*) AS total
        FROM reg_periksa rp
        LEFT JOIN dpjp_ranap dr
          ON dr.no_rawat = rp.no_rawat
          AND dr.kd_dokter = ?
        WHERE rp.no_rawat = ?
          AND (
            rp.kd_dokter = ?
            OR dr.kd_dokter IS NOT NULL
          )
      `,
      [normalizedKdDokter, normalizedNoRawat, normalizedKdDokter]
    );

    return Number(rows?.[0]?.total || 0) > 0;
  }

  static async getFiles(noRawat, kdDokter = '') {
    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const canDelete = await this.canManageFilesForVisit(noRawat, kdDokter);

    const sql = `
      SELECT
        bdp.no_rawat,
        bdp.kode,
        bdp.lokasi_file,
        COALESCE(mbd.nama, bdp.kode) AS nama_berkas
      FROM berkas_digital_perawatan bdp
      LEFT JOIN master_berkas_digital mbd ON mbd.kode = bdp.kode
      WHERE bdp.no_rawat = ?
      ORDER BY COALESCE(mbd.nama, bdp.kode) ASC, bdp.lokasi_file ASC
    `;

    const rows = await executeQuery(sql, [noRawat]);
    const data = rows.map((row) => {
      const lokasiFile = String(row.lokasi_file || '').trim();
      const fileName = this.extractFileName(lokasiFile);
      const fileUrl = this.buildFileUrl(lokasiFile);

      return {
        id: `${row.no_rawat}-${row.kode}-${lokasiFile}`,
        no_rawat: row.no_rawat,
        kode: String(row.kode || '').trim(),
        nama_berkas: String(row.nama_berkas || row.kode || '').trim(),
        lokasi_file: lokasiFile,
        nama_file: fileName,
        tipe_file: this.inferMimeType(fileName),
        url: fileUrl,
        can_delete: canDelete,
      };
    });

    return {
      // #region debug-point D:response-payload
      ...(reportDigitalFilesDebug('D', 'digitalFilesService:getFiles', '[DEBUG] Returning digital files payload', {
        noRawat,
        filesCount: data.length,
        uploadsBaseUrl: this.getUploadsBaseUrl() || null
      }), {}),
      // #endregion
      success: true,
      data,
      uploads_base_url: this.getUploadsBaseUrl(),
    };
  }

  static async deleteFile({ noRawat, kode, lokasiFile, kdDokter }) {
    const normalizedNoRawat = String(noRawat || '').trim();
    const normalizedKode = String(kode || '').trim();
    const normalizedLokasiFile = String(lokasiFile || '').trim();
    const normalizedKdDokter = String(kdDokter || '').trim();

    if (!normalizedNoRawat || !normalizedKode || !normalizedLokasiFile) {
      throw new Error('no_rawat, kode, dan lokasi_file wajib diisi');
    }

    const canDelete = await this.canManageFilesForVisit(normalizedNoRawat, normalizedKdDokter);
    if (!canDelete) {
      const error = new Error('Anda tidak memiliki hak untuk menghapus berkas digital ini');
      error.statusCode = 403;
      throw error;
    }

    const existingRows = await executeQuery(
      `
        SELECT no_rawat, kode, lokasi_file
        FROM berkas_digital_perawatan
        WHERE no_rawat = ?
          AND kode = ?
          AND lokasi_file = ?
        LIMIT 1
      `,
      [normalizedNoRawat, normalizedKode, normalizedLokasiFile]
    );

    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      const error = new Error('Berkas digital tidak ditemukan');
      error.statusCode = 404;
      throw error;
    }

    await executeQuery(
      `
        DELETE FROM berkas_digital_perawatan
        WHERE no_rawat = ?
          AND kode = ?
          AND lokasi_file = ?
        LIMIT 1
      `,
      [normalizedNoRawat, normalizedKode, normalizedLokasiFile]
    );

    return {
      success: true,
      message: 'Berkas digital berhasil dihapus',
      data: {
        no_rawat: normalizedNoRawat,
        kode: normalizedKode,
        lokasi_file: normalizedLokasiFile
      }
    };
  }

  static async uploadFiles({ noRawat, kode, files = [] }) {
    const normalizedNoRawat = String(noRawat || '').trim();
    const normalizedKode = String(kode || '').trim();
    const uploadApiUrl = this.getUploadApiUrl();
    const uploadToken = this.getUploadToken();

    if (!normalizedNoRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    if (!normalizedKode) {
      throw new Error('kode berkas wajib diisi');
    }

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Minimal satu file harus dipilih');
    }

    if (!uploadApiUrl) {
      throw new Error('DIGITAL_FILES_UPLOAD_API_URL belum dikonfigurasi');
    }

    if (!uploadToken) {
      throw new Error('DIGITAL_FILES_UPLOAD_TOKEN belum dikonfigurasi');
    }

    const uploaded = [];
    const failed = [];

    for (const file of files) {
      const mimeType = String(file?.mimetype || '').trim().toLowerCase();
      const originalName = String(file?.originalname || '').trim() || 'berkas';
      const fileSize = Number(file?.size || 0);

      if (!this.ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
        failed.push({
          nama_file: originalName,
          error: 'Tipe file tidak didukung. Hanya JPG, JPEG, PNG, dan PDF.'
        });
        continue;
      }

      if (fileSize <= 0 || fileSize > this.MAX_UPLOAD_SIZE_BYTES) {
        failed.push({
          nama_file: originalName,
          error: 'Ukuran file maksimal 5 MB.'
        });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([file.buffer], { type: file.mimetype }),
          originalName
        );
        formData.append('token', uploadToken);
        formData.append('no_rawat', normalizedNoRawat);
        formData.append('kode', normalizedKode);

        const response = await fetch(uploadApiUrl, {
          method: 'POST',
          body: formData
        });

        const responseText = await response.text();
        let payload = null;

        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = null;
        }

        if (!response.ok || payload?.status !== 'Success') {
          failed.push({
            nama_file: originalName,
            error: payload?.message || payload?.error || responseText || 'Upload gagal'
          });
          continue;
        }

        uploaded.push({
          nama_file: originalName,
          status: payload?.status || 'Success'
        });
      } catch (error) {
        failed.push({
          nama_file: originalName,
          error: error instanceof Error ? error.message : 'Upload gagal'
        });
      }
    }

    return {
      success: failed.length === 0,
      data: {
        no_rawat: normalizedNoRawat,
        kode: normalizedKode,
        total: files.length,
        uploaded,
        failed
      },
      message: failed.length === 0
        ? `${uploaded.length} file berhasil di-upload`
        : `${uploaded.length} file berhasil, ${failed.length} file gagal`
    };
  }
}

export default DigitalFilesService;
