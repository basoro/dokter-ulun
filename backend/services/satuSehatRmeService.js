import db from '../config/database.js';

const TABLE_VISIT = 'mlite_satu_sehat_erm_ralan';
const TABLE_LOG = 'mlite_satu_sehat_erm_log';
const TABLE_PRACTITIONER = 'mlite_satu_sehat_mapping_praktisi';

const LOG_CHL = 'chl';
const LOG_SHL = 'shl';
const LOG_CONSENT = 'consent';

const NIK_SYSTEM = 'https://fhir.kemkes.go.id/id/nik';

// Cache access token per host (berlaku untuk 1 proses server).
const tokenCache = new Map();

/**
 * RME Nasional SATUSEHAT (ChaRME) untuk aplikasi Dokter Ulun.
 *
 * Mengikuti alur plugin Satu Sehat mLITE: OAuth2 client credentials ->
 * Consent Health Link (POST /ssrme/v2/ntl/chl) -> buka RME Nasional
 * (POST /ssrme/v2/ntl/shl).
 *
 * Konfigurasi dibaca dari tabel `mlite_settings` (module `satu_sehat`) sehingga
 * pengaturan yang sudah diisi pada mLITE langsung dipakai oleh aplikasi ini.
 */
class SatuSehatRmeService {
  static REQUEST_TIMEOUT_MS = 60000;

  /** Normalisasi no_rawat: `20250102000001` -> `2025/01/02/000001`. */
  static normalizeNoRawat(noRawat) {
    const value = String(noRawat || '').trim();
    if (!value || value.includes('/') || value.length < 14) {
      return value;
    }

    return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}/${value.slice(8)}`;
  }

  /** Ambil seluruh pengaturan yang dibutuhkan (module satu_sehat & settings). */
  static async getSettings() {
    const [rows] = await db.execute(
      "SELECT module, field, value FROM mlite_settings WHERE module IN ('satu_sehat', 'settings')"
    );

    const result = { satuSehat: {}, general: {} };
    for (const row of rows || []) {
      const field = String(row.field || '').trim();
      if (!field) {
        continue;
      }
      const bucket = row.module === 'satu_sehat' ? result.satuSehat : result.general;
      bucket[field] = String(row.value ?? '').trim();
    }

    return result;
  }

  /** Satu pengaturan modul Satu Sehat. */
  static getSetting(settings, field) {
    const value = settings?.satuSehat?.[field];
    return value === undefined || value === null ? '' : String(value).trim();
  }

  /**
   * Buat tabel tracking & log bila belum ada (idempoten), mengikuti pola
   * `SatuSehatResourceMappingService::ensureTables()` pada plugin mLITE.
   *
   * Tanpa tabel ini alur tetap berjalan karena semua query bersifat defensif,
   * tetapi: `patient_id` tidak ter-cache (lookup NIK diulang setiap klik),
   * request/response ChaRME tidak tercatat (sulit didiagnosis), dan link
   * consent lama tidak dapat diambil ulang.
   */
  static tablesEnsured = false;

  static async ensureTables() {
    if (SatuSehatRmeService.tablesEnsured) {
      return;
    }
    SatuSehatRmeService.tablesEnsured = true;

    try {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_VISIT} (
          no_rawat VARCHAR(20) NOT NULL,
          patient_id VARCHAR(64) DEFAULT '',
          encounter_id VARCHAR(64) DEFAULT '',
          practitioner_id VARCHAR(64) DEFAULT '',
          location_id VARCHAR(64) DEFAULT '',
          organization_id VARCHAR(64) DEFAULT '',
          resource_map TEXT,
          status_kirim VARCHAR(20) DEFAULT 'belum',
          tgl_kirim DATETIME DEFAULT NULL,
          keterangan TEXT,
          PRIMARY KEY (no_rawat)
        )`
      );
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${TABLE_LOG} (
          id VARCHAR(40) NOT NULL,
          no_rawat VARCHAR(20) DEFAULT '',
          status VARCHAR(20) DEFAULT '',
          http_code INTEGER DEFAULT 0,
          duration_ms INTEGER DEFAULT 0,
          jumlah_resource INTEGER DEFAULT 0,
          message TEXT,
          request TEXT,
          response TEXT,
          created_at DATETIME DEFAULT NULL,
          PRIMARY KEY (id)
        )`
      );
    } catch (error) {
      // Diabaikan: pemakai database mungkin tidak punya hak CREATE.
      // Seluruh query ke tabel ini sudah defensif (try/catch).
    }
  }

  /** Data kunjungan + pasien + dokter untuk sebuah no_rawat. */
  static async getVisitContext(noRawat) {
    const [rows] = await db.execute(
      `SELECT
         rp.no_rawat,
         rp.kd_dokter,
         rp.kd_poli,
         rp.status_lanjut,
         rp.tgl_registrasi,
         rp.no_rkm_medis,
         p.nm_pasien,
         p.no_ktp,
         d.nm_dokter,
         pg.no_ktp AS nik_dokter
       FROM reg_periksa rp
       LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
       LEFT JOIN dokter d ON d.kd_dokter = rp.kd_dokter
       LEFT JOIN pegawai pg ON pg.nik = d.kd_dokter
       WHERE rp.no_rawat = ?
       LIMIT 1`,
      [noRawat]
    );

    return rows?.[0] || null;
  }

  /** Mapping kunjungan (tabel tracking ERM) untuk no_rawat. */
  static async getVisitMapping(noRawat) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM ${TABLE_VISIT} WHERE no_rawat = ? LIMIT 1`,
        [noRawat]
      );
      return rows?.[0] || null;
    } catch (error) {
      return null;
    }
  }

  /** Simpan / perbarui patient_id pada tabel tracking kunjungan. */
  static async savePatientId(noRawat, patientId) {
    const id = String(patientId || '').trim();
    if (!id) {
      return false;
    }

    try {
      await db.execute(
        `INSERT INTO ${TABLE_VISIT} (no_rawat, patient_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE patient_id = VALUES(patient_id)`,
        [noRawat, id]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /** ID IHS praktisi dari Mapping Praktisi (kd_dokter). */
  static async getPractitionerId(kdDokter) {
    const kode = String(kdDokter || '').trim();
    if (!kode) {
      return '';
    }

    try {
      const [rows] = await db.execute(
        `SELECT practitioner_id FROM ${TABLE_PRACTITIONER} WHERE kd_dokter = ? LIMIT 1`,
        [kode]
      );
      return String(rows?.[0]?.practitioner_id || '').trim();
    } catch (error) {
      return '';
    }
  }

  /** Catat satu baris log RME (tabel log yang sama dengan ERM mLITE). */
  static async writeLog(noRawat, status, httpCode = 0, durationMs = 0, message = '', request = null, response = null) {
    if (!noRawat) {
      return;
    }

    const id = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random()
      .toString(16)
      .slice(2, 10)}`;

    try {
      await db.execute(
        `INSERT INTO ${TABLE_LOG}
           (id, no_rawat, status, http_code, duration_ms, jumlah_resource, message, request, response, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NOW())`,
        [
          id,
          noRawat,
          String(status),
          Number(httpCode) || 0,
          Number(durationMs) || 0,
          String(message || ''),
          request === null ? null : JSON.stringify(request),
          response === null ? null : JSON.stringify(response)
        ]
      );
    } catch (error) {
      // Tabel log mungkin belum dibuat bila plugin Satu Sehat belum dipakai.
    }
  }

  /** URL persetujuan (consent) terakhir dari log chl/consent. */
  static async lastConsentUrl(noRawat) {
    try {
      const [rows] = await db.execute(
        `SELECT status, response FROM ${TABLE_LOG}
         WHERE no_rawat = ? AND status IN ('consent', 'chl')
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [noRawat]
      );

      const row = rows?.[0];
      if (!row) {
        return '';
      }

      let parsed = null;
      try {
        parsed = row.response ? JSON.parse(String(row.response)) : null;
      } catch (error) {
        return '';
      }

      const data = parsed?.data;
      if (typeof data === 'string' && /^https?:\/\//i.test(data.trim())) {
        return data.trim();
      }
      if (data && typeof data === 'object') {
        return String(data.url || data.verification_url || '').trim();
      }

      return String(parsed?.verificationUrl || parsed?.url || '').trim();
    } catch (error) {
      return '';
    }
  }

  /** Host (+ skema) dari sebuah URL. */
  static hostOf(url) {
    try {
      const parsed = new URL(String(url || '').trim());
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      return '';
    }
  }

  /** Base URL API RME/ChaRME (dari setting rme_authurl, fallback authurl FHIR). */
  static rmeBaseUrl(settings) {
    const rmeAuthUrl = SatuSehatRmeService.getSetting(settings, 'rme_authurl');
    if (rmeAuthUrl) {
      const host = SatuSehatRmeService.hostOf(rmeAuthUrl);
      if (host) {
        return host;
      }
    }

    return SatuSehatRmeService.hostOf(SatuSehatRmeService.getSetting(settings, 'authurl'));
  }

  /** URL endpoint Consent Health Link. */
  static chlUrl(settings) {
    const configured = SatuSehatRmeService.getSetting(settings, 'chlurl');
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    const base = SatuSehatRmeService.rmeBaseUrl(settings);
    return base ? `${base}/ssrme/v2/ntl/chl` : '';
  }

  /** URL endpoint buka RME Nasional (Smart Health Link). */
  static shlUrl(settings) {
    const configured = SatuSehatRmeService.getSetting(settings, 'shlurl');
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    const base = SatuSehatRmeService.rmeBaseUrl(settings);
    return base ? `${base}/ssrme/v2/ntl/shl` : '';
  }

  /** Request form-urlencoded / JSON dengan timeout. */
  static async requestJson(url, { method = 'POST', body, headers = {}, form = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SatuSehatRmeService.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: form
          ? { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...headers }
          : { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
        body,
        signal: controller.signal
      });

      const text = await response.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (error) {
        json = text ? { raw: text } : null;
      }

      return { json, http_code: response.status, error: '' };
    } catch (error) {
      return { json: null, http_code: 0, error: error?.message || 'Koneksi gagal.' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Access token OAuth2 dari host tertentu. */
  static async fetchToken(authUrl, clientId, secretKey) {
    if (!authUrl || !clientId) {
      return '';
    }

    const cacheKey = authUrl;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: secretKey
    }).toString();

    const response = await SatuSehatRmeService.requestJson(
      `${authUrl.replace(/\/+$/, '')}/accesstoken?grant_type=client_credentials`,
      { method: 'POST', body, form: true }
    );

    const token = String(response.json?.access_token || '').trim();
    if (!token) {
      return '';
    }

    const expiresIn = Number(response.json?.expires_in || 3600);
    tokenCache.set(cacheKey, {
      token,
      expires: Date.now() + Math.max(60, expiresIn - 60) * 1000
    });

    return token;
  }

  /**
   * Access token khusus RME/ChaRME. Bila host RME sama dengan host authurl FHIR,
   * token FHIR dipakai ulang; selain itu diminta dari host RME.
   */
  static async getRmeAccessToken(settings) {
    const clientId = SatuSehatRmeService.getSetting(settings, 'clientid');
    const secretKey = SatuSehatRmeService.getSetting(settings, 'secretkey');

    let tokenBase = '';
    for (const key of ['rme_authurl', 'chlurl', 'shlurl']) {
      const host = SatuSehatRmeService.hostOf(SatuSehatRmeService.getSetting(settings, key));
      if (host) {
        tokenBase = host;
        break;
      }
    }
    if (!tokenBase) {
      tokenBase = SatuSehatRmeService.rmeBaseUrl(settings);
    }

    const authUrl = SatuSehatRmeService.getSetting(settings, 'authurl');
    const rmeHost = SatuSehatRmeService.hostOf(tokenBase);
    const authHost = SatuSehatRmeService.hostOf(authUrl);

    if (authHost && rmeHost && authHost === rmeHost) {
      return SatuSehatRmeService.fetchToken(authUrl, clientId, secretKey);
    }

    return SatuSehatRmeService.fetchToken(
      tokenBase ? `${tokenBase}/oauth2/v1` : '',
      clientId,
      secretKey
    );
  }

  /** Access token untuk API FHIR (host authurl), dipakai lookup Patient via NIK. */
  static async getFhirAccessToken(settings) {
    return SatuSehatRmeService.fetchToken(
      SatuSehatRmeService.getSetting(settings, 'authurl'),
      SatuSehatRmeService.getSetting(settings, 'clientid'),
      SatuSehatRmeService.getSetting(settings, 'secretkey')
    );
  }

  /** Cari ID IHS pasien dari SATUSEHAT berdasarkan NIK. */
  static async lookupPatientIdByNik(nik, settings) {
    const nilai = String(nik || '').trim();
    if (!nilai) {
      return '';
    }

    const fhirUrl = SatuSehatRmeService.getSetting(settings, 'fhirurl');
    const token = await SatuSehatRmeService.getFhirAccessToken(settings);
    if (!fhirUrl || !token) {
      return '';
    }

    const identifier = encodeURIComponent(`${NIK_SYSTEM}|${nilai}`);
    const response = await SatuSehatRmeService.requestJson(
      `${fhirUrl.replace(/\/+$/, '')}/Patient?identifier=${identifier}`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    );

    return String(response.json?.entry?.[0]?.resource?.id || '').trim();
  }

  /** Cari nama dan ID praktisi SATUSEHAT berdasarkan NIK, mengikuti mLITE. */
  static async lookupPractitionerByNik(nik, settings) {
    const nilai = String(nik || '').trim();
    if (!nilai) {
      return { found: false, id: '', name: '' };
    }

    const fhirUrl = SatuSehatRmeService.getSetting(settings, 'fhirurl');
    const token = await SatuSehatRmeService.getFhirAccessToken(settings);
    if (!fhirUrl || !token) {
      return { found: false, id: '', name: '' };
    }

    const identifier = encodeURIComponent(`${NIK_SYSTEM}|${nilai}`);
    const response = await SatuSehatRmeService.requestJson(
      `${fhirUrl.replace(/\/+$/, '')}/Practitioner?identifier=${identifier}`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    );
    const practitioner = response.json?.entry?.find(
      (entry) => entry?.resource?.resourceType === 'Practitioner'
    )?.resource;
    if (!practitioner) {
      return { found: false, id: '', name: '' };
    }

    const names = Array.isArray(practitioner.name) ? practitioner.name : [];
    const name = names
      .map((item) => String(item.text || `${(item.given || []).join(' ')} ${item.family || ''}`).trim())
      .filter(Boolean)
      .join('; ');

    return {
      found: Boolean(practitioner.id),
      id: String(practitioner.id || '').trim(),
      name
    };
  }

  /**
   * Ambil resource FHIR tunggal (Patient/Practitioner) untuk diagnosa.
   *
   * @returns {Promise<{found:boolean,http_code:number,id:string,name:string,nik:string,active:string,error:string}>}
   */
  static async fetchFhirResource(resourceType, id, settings) {
    const resourceTypeUpper = String(resourceType || '').toUpperCase();
    if (!['PATIENT', 'PRACTITIONER'].includes(resourceTypeUpper)) {
      return { found: false, http_code: 0, id: '', name: '', nik: '', active: '', error: 'Tipe resource tidak didukung.' };
    }

    const fhirUrl = SatuSehatRmeService.getSetting(settings, 'fhirurl');
    const token = await SatuSehatRmeService.getFhirAccessToken(settings);
    if (!fhirUrl || !token) {
      return { found: false, http_code: 0, id: '', name: '', nik: '', active: '', error: 'Konfigurasi FHIR/token belum tersedia.' };
    }

    const resourceId = String(id || '').trim();
    if (!resourceId) {
      return { found: false, http_code: 0, id: '', name: '', nik: '', active: '', error: 'ID wajib diisi.' };
    }

    const response = await SatuSehatRmeService.requestJson(
      `${fhirUrl.replace(/\/+$/, '')}/${resourceTypeUpper === 'PATIENT' ? 'Patient' : 'Practitioner'}/${encodeURIComponent(resourceId)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.error) {
      return { found: false, http_code: response.http_code, id: '', name: '', nik: '', active: '', error: response.error };
    }

    if (response.http_code === 404) {
      return { found: false, http_code: 404, id: '', name: '', nik: '', active: '', error: 'Resource tidak ditemukan di SATUSEHAT.' };
    }

    const resource = response.json;
    if (resource?.resourceType === 'OperationOutcome' || !resource || resource.resourceType !== (resourceTypeUpper === 'PATIENT' ? 'Patient' : 'Practitioner')) {
      const message = String(resource?.issue?.[0]?.diagnostics || '') || `Respons tidak valid (HTTP ${response.http_code}).`;
      return { found: false, http_code: response.http_code, id: '', name: '', nik: '', active: '', error: message };
    }

    const names = Array.isArray(resource.name) ? resource.name : [];
    const name = names.map((n) => String(n.text || (n.given || []).join(' ') + ' ' + String(n.family || '')).trim()).filter(Boolean).join('; ');

    let nik = '';
    for (const identifierEntry of Array.isArray(resource.identifier) ? resource.identifier : []) {
      if (String(identifierEntry?.system || '') === NIK_SYSTEM) {
        nik = String(identifierEntry?.value || '').trim();
        if (nik) {
          break;
        }
      }
    }

    return {
      found: true,
      http_code: response.http_code,
      id: String(resource.id || '').trim(),
      name,
      nik,
      active: resource.active === undefined || resource.active === null ? '' : (resource.active ? 'true' : 'false'),
      error: ''
    };
  }

  /** Payload standar CHL/SHL (nilai teks dirapikan agar cocok dengan ChaRME). */
  static buildPayload(ctx) {
    const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

    const payload = {
      patient_id: clean(ctx.patient_id),
      patient_name: clean(ctx.patient_name),
      practitioner_id: clean(ctx.practitioner_id),
      practitioner_name: clean(ctx.practitioner_name),
      organization_id: clean(ctx.organization_id),
      organization_name: clean(ctx.organization_name)
    };

    if (ctx.type_medical_summary) {
      payload.type_medical_summary = String(ctx.type_medical_summary).trim().toUpperCase();
    }

    return payload;
  }

  /**
   * Interpretasi envelope respons RME Nasional.
   *
   * HTTP 200 dengan `success:false` / `error:true` tetap dianggap gagal, dan
   * `data.code = CONSENT_REQUIRED` berarti pasien belum memberi persetujuan.
   */
  static interpret(response, successMessage) {
    if (response.error) {
      return {
        outcome: 'error',
        message: `Gagal menghubungi server SATUSEHAT: ${response.error}`,
        url: '',
        request_id: ''
      };
    }

    const json = response.json;
    if (!json || typeof json !== 'object') {
      return {
        outcome: 'error',
        message: `Response tidak valid dari server SATUSEHAT (HTTP ${response.http_code}).`,
        url: '',
        request_id: ''
      };
    }

    const data = json.data ?? null;
    const dataCode = String((data && typeof data === 'object' ? data.code : '') || '').toUpperCase();
    const requestId = String(json.request_id || '');

    let message = String(json.message || '');
    if (!message && typeof data === 'string') {
      message = data;
    }
    if (!message && data && typeof data === 'object') {
      message = String(data.message || '');
    }

    let url = '';
    if (typeof data === 'string' && /^https?:\/\//i.test(data.trim())) {
      url = data.trim();
    } else if (data && typeof data === 'object') {
      url = String(data.verificationUrl || data.shlinkUrl || data.url || data.verification_url || '');
    }
    if (!url) {
      url = String(json.verificationUrl || json.shlinkUrl || json.url || json.verification_url || '');
    }

    if (dataCode === 'CONSENT_REQUIRED') {
      return {
        outcome: 'consent_required',
        message: message || 'Consent pasien diperlukan.',
        url: '',
        request_id: requestId
      };
    }

    if (json.success === false || json.error === true) {
      const innerCode = json.code !== undefined ? String(json.code) : '';
      const suffix = innerCode && innerCode !== String(response.http_code) ? ` (kode ${innerCode})` : '';
      return {
        outcome: 'error',
        message: `${message || 'Permintaan ditolak SATUSEHAT.'} (HTTP ${response.http_code})${suffix}`,
        url: '',
        request_id: requestId
      };
    }

    const httpOk = response.http_code >= 200 && response.http_code < 300;
    const envelopeOk = (json.success === true || json.success === undefined || json.success === null) && json.error !== true;
    if (envelopeOk && httpOk && url) {
      return {
        outcome: 'success',
        message: message || successMessage,
        url,
        request_id: requestId
      };
    }

    return {
      outcome: 'error',
      message: `${message || 'Permintaan gagal.'} (HTTP ${response.http_code})`,
      url: '',
      request_id: requestId
    };
  }

  /** POST JSON ke endpoint RME Nasional dengan Bearer token. */
  static async postRme(url, payload, settings) {
    const token = await SatuSehatRmeService.getRmeAccessToken(settings);
    if (!token || !url) {
      return { json: null, http_code: 0, error: 'Token/konfigurasi SATUSEHAT belum tersedia.' };
    }

    return SatuSehatRmeService.requestJson(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  /**
   * Buat Consent Health Link (POST /ssrme/v2/ntl/chl).
   *
   * @returns {Promise<{status:string,message:string,url:string,http_code:number,raw:any}>}
   */
  static async createConsentHealthLink(ctx, settings, noRawat) {
    const endpoint = SatuSehatRmeService.chlUrl(settings);
    if (!endpoint) {
      const message = 'URL endpoint Consent Health Link (chlurl/authurl) belum dikonfigurasi.';
      await SatuSehatRmeService.writeLog(noRawat, LOG_CHL, 0, 0, `Gagal: ${message}`);
      return { status: 'error', message, url: '', http_code: 0, raw: null };
    }

    const payload = SatuSehatRmeService.buildPayload(ctx);
    const started = Date.now();
    const response = await SatuSehatRmeService.postRme(endpoint, payload, settings);
    const durationMs = Date.now() - started;
    const parsed = SatuSehatRmeService.interpret(response, 'Consent Health Link berhasil dibuat.');

    await SatuSehatRmeService.writeLog(
      noRawat,
      LOG_CHL,
      response.http_code,
      durationMs,
      `${parsed.outcome === 'success' ? '' : 'Gagal: '}${parsed.message}`,
      payload,
      response.json ?? response.error
    );

    return {
      status: parsed.outcome === 'success' ? 'success' : 'error',
      message: parsed.message,
      url: parsed.outcome === 'success' ? parsed.url : '',
      http_code: response.http_code,
      raw: response.json || null
    };
  }

  /**
   * Buka RME Nasional (POST /ssrme/v2/ntl/shl).
   *
   * @returns {Promise<{status:string,message:string,url:string,http_code:number}>}
   */
  static async openRmeNasional(ctx, settings, noRawat) {
    const endpoint = SatuSehatRmeService.shlUrl(settings);
    if (!endpoint) {
      const message = 'URL endpoint SHLink (shlurl/authurl) belum dikonfigurasi.';
      await SatuSehatRmeService.writeLog(noRawat, LOG_SHL, 0, 0, `Gagal: ${message}`);
      return { status: 'error', message, url: '', http_code: 0 };
    }

    const payload = SatuSehatRmeService.buildPayload(ctx);
    const started = Date.now();
    const response = await SatuSehatRmeService.postRme(endpoint, payload, settings);
    const durationMs = Date.now() - started;
    const parsed = SatuSehatRmeService.interpret(response, 'RME Nasional siap dibuka.');

    const logMessage = parsed.outcome === 'consent_required'
      ? `${parsed.message} (CONSENT_REQUIRED)`
      : `${parsed.outcome === 'success' ? '' : 'Gagal: '}${parsed.message}`;

    await SatuSehatRmeService.writeLog(
      noRawat,
      LOG_SHL,
      response.http_code,
      durationMs,
      logMessage,
      payload,
      response.json ?? response.error
    );

    return {
      status: parsed.outcome === 'success'
        ? 'success'
        : (parsed.outcome === 'consent_required' ? 'consent_required' : 'error'),
      message: parsed.message,
      url: parsed.outcome === 'success' ? parsed.url : '',
      http_code: response.http_code
    };
  }

  /**
   * Endpoint utama tombol SATUSEHAT pada halaman rekam medis pasien.
   *
   * @param {string} noRawat Nomor rawat kunjungan (format `2025/01/02/000001`
   *                         maupun tanpa garis miring).
   * @returns {Promise<{status:string,message:string,url?:string,consent_url?:string,http_status:number}>}
   */
  static async openRmeForVisit(noRawat) {
    const nomorRawat = SatuSehatRmeService.normalizeNoRawat(noRawat);
    if (!nomorRawat) {
      return { status: 'error', message: 'No. rawat wajib diisi.', http_status: 422 };
    }

    const visit = await SatuSehatRmeService.getVisitContext(nomorRawat);
    if (!visit) {
      return {
        status: 'error',
        message: `Kunjungan ${nomorRawat} tidak ditemukan.`,
        http_status: 404
      };
    }

    const settings = await SatuSehatRmeService.getSettings();
    if (!SatuSehatRmeService.getSetting(settings, 'clientid')) {
      return {
        status: 'error',
        message: 'Konfigurasi SATUSEHAT (Client ID) belum diisi pada modul Satu Sehat mLITE.',
        http_status: 422
      };
    }

    await SatuSehatRmeService.ensureTables();

    // ID IHS pasien: dari mapping kunjungan, lalu lookup NIK ke SATUSEHAT.
    const mapping = await SatuSehatRmeService.getVisitMapping(nomorRawat);
    let patientId = String(mapping?.patient_id || '').trim();
    if (!patientId) {
      patientId = await SatuSehatRmeService.lookupPatientIdByNik(visit.no_ktp, settings);
      if (patientId) {
        await SatuSehatRmeService.savePatientId(nomorRawat, patientId);
      }
    }

    const practitionerId = mapping?.practitioner_id
      ? String(mapping.practitioner_id).trim()
      : await SatuSehatRmeService.getPractitionerId(visit.kd_dokter);
    const organizationId = SatuSehatRmeService.getSetting(settings, 'organizationid');

    const missing = [];
    if (!patientId) {
      missing.push('ID IHS pasien (mapping pasien / NIK tidak ditemukan)');
    }
    if (!practitionerId) {
      missing.push('ID IHS praktisi (Mapping Praktisi)');
    }
    if (!organizationId) {
      missing.push('ID Organization SATUSEHAT (pengaturan plugin)');
    }
    if (missing.length) {
      return {
        status: 'error',
        message: `Data belum lengkap: ${missing.join(', ')}.`,
        http_status: 422
      };
    }

    // Nama praktisi & pasien diambil dari SATUSEHAT (FHIR) bila ID dikenal.
    // ChaRME sensitif terhadap ketidakcocokan string: nama lokal yang memuat
    // gelar (mis. "dr. ... Sp.B") atau spasi/teks lain yang tidak persis sama
    // dengan data server dapat membuat CHL/SHL gagal. Fallback ke nama lokal
    // bila resource tidak ditemukan.
    const patientResource = await SatuSehatRmeService.fetchFhirResource('Patient', patientId, settings);
    const practitionerByNik = await SatuSehatRmeService.lookupPractitionerByNik(visit.nik_dokter, settings);
    const practitionerResource = practitionerByNik.found && practitionerByNik.id === practitionerId
      ? practitionerByNik
      : await SatuSehatRmeService.fetchFhirResource('Practitioner', practitionerId, settings);

    const ctx = {
      patient_id: patientId,
      patient_name: patientResource.found && patientResource.name
        ? patientResource.name
        : String(visit.nm_pasien || ''),
      practitioner_id: practitionerId,
      practitioner_name: practitionerResource.found && practitionerResource.name
        ? practitionerResource.name
        : String(visit.nm_dokter || ''),
      organization_id: organizationId,
      organization_name: String(settings.general.nama_instansi || '')
    };

    const open = await SatuSehatRmeService.openRmeNasional(ctx, settings, nomorRawat);
    if (open.status === 'success') {
      return {
        status: 'success',
        message: open.message,
        url: open.url,
        http_status: 200
      };
    }

    if (open.status !== 'consent_required') {
      return { status: 'error', message: open.message, http_status: open.http_code || 502 };
    }

    // Consent belum ada: buat Consent Health Link, dengan bypass EMERGENCY
    // hanya untuk kunjungan di poliklinik IGD (settings.igd).
    const chlCtx = { ...ctx };
    const igdPoli = String(settings.general.igd || '').trim();
    const kdPoli = String(visit.kd_poli || '').trim();
    if (igdPoli && kdPoli === igdPoli) {
      chlCtx.type_medical_summary = 'EMERGENCY';
    }

    let chl = await SatuSehatRmeService.createConsentHealthLink(chlCtx, settings, nomorRawat);
    let consentUrl = chl.url;

    if (chl.status === 'success' && consentUrl) {
      await SatuSehatRmeService.writeLog(
        nomorRawat,
        LOG_CONSENT,
        chl.http_code,
        0,
        chlCtx.type_medical_summary
          ? 'Consent verification link dibuat (bypass EMERGENCY).'
          : 'Consent verification link dibuat.',
        null,
        { verificationUrl: consentUrl }
      );
    }

    if (chl.status !== 'success' && !consentUrl) {
      consentUrl = await SatuSehatRmeService.lastConsentUrl(nomorRawat);
    }

    // Fallback opsional (setting rme_emergency_fallback): bila CHL jalur normal
    // gagal di server ChaRME, coba sekali lagi dengan bypass EMERGENCY.
    if (chl.status !== 'success' && SatuSehatRmeService.getSetting(settings, 'rme_emergency_fallback')) {
      const fallbackCtx = { ...chlCtx, type_medical_summary: 'EMERGENCY' };
      const fallback = await SatuSehatRmeService.createConsentHealthLink(fallbackCtx, settings, nomorRawat);
      consentUrl = fallback.url;
      if (fallback.status === 'success' && consentUrl) {
        chl = fallback;
        await SatuSehatRmeService.writeLog(
          nomorRawat,
          LOG_CONSENT,
          fallback.http_code,
          0,
          'Consent verification link dibuat via fallback EMERGENCY (CHL normal gagal).',
          null,
          { verificationUrl: consentUrl }
        );
      }
    }

    // Coba buka RME lagi setelah consent link tersedia.
    if (chl.status === 'success') {
      const retry = await SatuSehatRmeService.openRmeNasional(ctx, settings, nomorRawat);
      if (retry.status === 'success') {
        return {
          status: 'success',
          message: retry.message,
          url: retry.url,
          consent_url: consentUrl,
          http_status: 200
        };
      }
    }

    const fallbackNote = chl.status !== 'success' && consentUrl
      ? ' Menampilkan link persetujuan yang pernah dibuat sebelumnya.'
      : '';

    return {
      status: 'consent_required',
      message: chl.status === 'success'
        ? 'Link persetujuan (consent) dibuat. Buka link berikut untuk menyetujui akses RME pasien.'
        : `${chl.message}${fallbackNote}`,
      consent_url: consentUrl,
      http_status: 200
    };
  }
}

export default SatuSehatRmeService;
