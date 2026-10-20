const PACS_ERROR_CODES = {
  DISABLED: 'PACS_DISABLED',
  AUTH_FAILED: 'PACS_AUTH_FAILED',
  TIMEOUT: 'PACS_TIMEOUT',
  NETWORK: 'PACS_NETWORK_ERROR',
  NOT_FOUND: 'PACS_NOT_FOUND',
  SERVER: 'PACS_SERVER_ERROR',
  REQUEST_FAILED: 'PACS_REQUEST_FAILED'
};

// Timeout milik kita sendiri tidak diulang agar total latensi tetap <= PACS_REQUEST_TIMEOUT_MS + retry jaringan.
const RETRIABLE_ERROR_CODES = [
  PACS_ERROR_CODES.NETWORK,
  PACS_ERROR_CODES.SERVER
];

const NETWORK_ERROR_CODES = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT'
];

/**
 * Client PACS (pacs.rshdbarabai.com) mengikuti dokumentasi simrs-integration.md:
 * auth service account + pencarian studi + signed viewer link.
 *
 * Kredensial hanya dipakai di backend. Jangan pernah mengirim token ke browser.
 */
class PacsClientService {
  static DEFAULT_REQUEST_TIMEOUT_MS = 5000;
  static DEFAULT_REQUEST_RETRY_COUNT = 1;
  static DEFAULT_VIEWER_LINK_TTL_MINUTES = 1440;
  static DEFAULT_STUDY_CACHE_TTL_MS = 2 * 60 * 1000;
  static DEFAULT_STUDY_LIST_LIMIT = 25;
  static DEFAULT_SERIES_LIST_LIMIT = 100;
  static DEFAULT_INSTANCE_LIST_LIMIT = 1000;
  static MAX_CACHE_ENTRIES = 200;
  static TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;
  static MIN_TOKEN_TTL_MS = 30 * 1000;

  static tokenState = {
    accessToken: '',
    refreshToken: '',
    expiresAt: 0
  };

  static tokenInFlight = null;
  static studyCache = new Map();
  static studyInFlight = new Map();
  static seriesCache = new Map();
  static seriesInFlight = new Map();

  static createError(code, message, extra = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, extra);
    return error;
  }

  static getPositiveIntegerEnvValue(key, fallbackValue) {
    const rawValue = Number.parseInt(String(process.env[key] || '').trim(), 10);
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : fallbackValue;
  }

  static wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static getConfig() {
    const enabledRaw = String(process.env.PACS_ENABLED ?? 'true').trim().toLowerCase();
    const baseUrl = String(process.env.PACS_BASE_URL || process.env.PACS_SERVER || '').trim().replace(/\/+$/, '');
    const username = String(process.env.PACS_SERVICE_USERNAME || process.env.PACS_USERNAME || '').trim();
    const password = String(process.env.PACS_SERVICE_PASSWORD || process.env.PACS_PASSWORD || '').trim();

    return {
      enabled: enabledRaw !== 'false' && enabledRaw !== '0',
      baseUrl,
      username,
      password
    };
  }

  static isEnabled() {
    const config = this.getConfig();
    return Boolean(config.enabled && config.baseUrl);
  }

  static normalizeDateOnly(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    const dashedMatch = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (dashedMatch) {
      return `${dashedMatch[1]}-${dashedMatch[2]}-${dashedMatch[3]}`;
    }

    const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compactMatch) {
      return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    return '';
  }

  static normalizeSearchText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  static readCacheEntry(store, cacheKey) {
    const cached = store.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      store.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  static writeCacheEntry(store, cacheKey, value, ttlMs) {
    if (store.size >= this.MAX_CACHE_ENTRIES && !store.has(cacheKey)) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) {
        store.delete(oldestKey);
      }
    }

    store.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs
    });

    return value;
  }

  static async withCache({ cacheStore, inFlightStore, cacheKey, ttlMs, factory }) {
    const cachedValue = this.readCacheEntry(cacheStore, cacheKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    const existingPromise = inFlightStore.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const nextPromise = (async () => {
      try {
        const result = await factory();
        return this.writeCacheEntry(cacheStore, cacheKey, result, ttlMs);
      } finally {
        inFlightStore.delete(cacheKey);
      }
    })();

    inFlightStore.set(cacheKey, nextPromise);
    return nextPromise;
  }

  static withStudyCache(cacheKey, ttlMs, factory) {
    return this.withCache({
      cacheStore: this.studyCache,
      inFlightStore: this.studyInFlight,
      cacheKey,
      ttlMs,
      factory
    });
  }

  static mapHttpStatusToErrorCode(status) {
    if (status === 401 || status === 403) {
      return PACS_ERROR_CODES.AUTH_FAILED;
    }

    if (status === 404) {
      return PACS_ERROR_CODES.NOT_FOUND;
    }

    if (status >= 500) {
      return PACS_ERROR_CODES.SERVER;
    }

    return PACS_ERROR_CODES.REQUEST_FAILED;
  }

  static isPacsError(error) {
    return Boolean(error?.code && String(error.code).startsWith('PACS_'));
  }

  static normalizeError(error) {
    if (this.isPacsError(error)) {
      return error;
    }

    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return this.createError(PACS_ERROR_CODES.TIMEOUT, 'Permintaan ke server PACS melebihi batas waktu');
    }

    const errorCode = String(error?.code || error?.cause?.code || '').trim().toUpperCase();
    if (NETWORK_ERROR_CODES.includes(errorCode)) {
      return this.createError(PACS_ERROR_CODES.NETWORK, `Gagal menghubungi server PACS (${errorCode})`);
    }

    return this.createError(PACS_ERROR_CODES.REQUEST_FAILED, error?.message || 'Permintaan PACS gagal');
  }

  static async sendOnce(pathname, { method = 'GET', headers = {}, body } = {}) {
    const config = this.getConfig();
    if (!config.enabled) {
      throw this.createError(PACS_ERROR_CODES.DISABLED, 'Integrasi PACS sedang dinonaktifkan');
    }

    if (!config.baseUrl) {
      throw this.createError(PACS_ERROR_CODES.DISABLED, 'Konfigurasi server PACS belum tersedia');
    }

    const timeoutMs = this.getPositiveIntegerEnvValue('PACS_REQUEST_TIMEOUT_MS', this.DEFAULT_REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}${pathname}`, {
        method,
        body,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...headers
        }
      });

      if (!response.ok) {
        throw this.createError(
          this.mapHttpStatusToErrorCode(response.status),
          `Permintaan PACS gagal dengan status ${response.status}`,
          { status: response.status }
        );
      }

      return response;
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async sendWithRetry(pathname, options = {}) {
    const retryCount = this.getPositiveIntegerEnvValue('PACS_REQUEST_RETRY_COUNT', this.DEFAULT_REQUEST_RETRY_COUNT);
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        return await this.sendOnce(pathname, options);
      } catch (error) {
        lastError = error;

        if (attempt < retryCount && RETRIABLE_ERROR_CODES.includes(error.code)) {
          await this.wait(250 * (attempt + 1));
          continue;
        }

        throw error;
      }
    }

    throw lastError || this.createError(PACS_ERROR_CODES.REQUEST_FAILED, 'Permintaan PACS gagal');
  }

  static storeTokenPayload(payload) {
    const expiresInSeconds = Number(payload?.expires_in);
    const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 30 * 60 * 1000;

    this.tokenState = {
      accessToken: String(payload?.access_token || ''),
      refreshToken: String(payload?.refresh_token || this.tokenState.refreshToken || ''),
      expiresAt: Date.now() + Math.max(ttlMs - this.TOKEN_EXPIRY_MARGIN_MS, this.MIN_TOKEN_TTL_MS)
    };

    return this.tokenState.accessToken;
  }

  static async login() {
    const config = this.getConfig();
    if (!config.username || !config.password) {
      throw this.createError(PACS_ERROR_CODES.AUTH_FAILED, 'Kredensial service account PACS belum dikonfigurasi');
    }

    const body = new URLSearchParams({
      username: config.username,
      password: config.password,
      grant_type: 'password'
    });

    const response = await this.sendWithRetry('/api/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const payload = await response.json().catch(() => null);
    if (!payload?.access_token) {
      throw this.createError(PACS_ERROR_CODES.AUTH_FAILED, 'PACS tidak mengembalikan access token');
    }

    return this.storeTokenPayload(payload);
  }

  static async refreshAccessToken() {
    const refreshToken = this.tokenState.refreshToken;
    if (!refreshToken) {
      return this.login();
    }

    try {
      const body = new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await this.sendWithRetry('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      const payload = await response.json().catch(() => null);
      if (!payload?.access_token) {
        throw this.createError(PACS_ERROR_CODES.AUTH_FAILED, 'PACS tidak mengembalikan access token hasil refresh');
      }

      return this.storeTokenPayload(payload);
    } catch (error) {
      if (error.code === PACS_ERROR_CODES.AUTH_FAILED) {
        return this.login();
      }

      throw error;
    }
  }

  static async getAccessToken({ force = false } = {}) {
    if (!force && this.tokenState.accessToken && this.tokenState.expiresAt > Date.now()) {
      return this.tokenState.accessToken;
    }

    if (this.tokenInFlight) {
      return this.tokenInFlight;
    }

    this.tokenInFlight = (async () => {
      try {
        if (force && this.tokenState.refreshToken) {
          return await this.refreshAccessToken();
        }

        return await this.login();
      } finally {
        this.tokenInFlight = null;
      }
    })();

    return this.tokenInFlight;
  }

  static async authorizedFetch(pathname, options = {}) {
    const accessToken = await this.getAccessToken();
    const buildHeaders = (token) => ({
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`
    });

    try {
      return await this.sendWithRetry(pathname, { ...options, headers: buildHeaders(accessToken) });
    } catch (error) {
      if (error.code !== PACS_ERROR_CODES.AUTH_FAILED) {
        throw error;
      }

      // Token kedaluwarsa/ditolak: refresh sekali, lalu ulangi satu kali.
      const refreshedToken = await this.getAccessToken({ force: true });
      return this.sendWithRetry(pathname, { ...options, headers: buildHeaders(refreshedToken) });
    }
  }

  static async findStudiesByPatientId(patientId, limit = this.DEFAULT_STUDY_LIST_LIMIT) {
    const normalizedPatientId = String(patientId || '').trim();
    if (!normalizedPatientId) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'Nomor rekam medis pasien belum tersedia');
    }

    const params = new URLSearchParams({
      patient_id: normalizedPatientId,
      limit: String(Math.max(1, Number(limit) || this.DEFAULT_STUDY_LIST_LIMIT))
    });

    const response = await this.authorizedFetch(`/api/v1/studies?${params.toString()}`);
    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];

    return items;
  }

  static pickMatchingStudy(studies, examDate, examName) {
    const normalizedDate = this.normalizeDateOnly(examDate);
    const datedStudies = normalizedDate
      ? studies.filter((study) => this.normalizeDateOnly(study?.study_date) === normalizedDate)
      : [];
    const candidates = datedStudies.length > 0 ? datedStudies : studies;

    if (candidates.length <= 1) {
      return candidates[0] || null;
    }

    const normalizedExam = this.normalizeSearchText(examName);
    if (!normalizedExam) {
      return candidates[0];
    }

    const matchedStudies = candidates.filter((study) => {
      const normalizedDescription = this.normalizeSearchText(study?.study_description || study?.accession_number);
      return normalizedDescription && (
        normalizedDescription.includes(normalizedExam) ||
        normalizedExam.includes(normalizedDescription)
      );
    });

    return (matchedStudies.length > 0 ? matchedStudies : candidates)[0] || null;
  }

  static async findStudyForRadiology({ patientId, examDate, examName }) {
    const normalizedPatientId = String(patientId || '').trim();
    if (!normalizedPatientId) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'Nomor rekam medis pasien belum tersedia');
    }

    const cacheTtlMs = this.getPositiveIntegerEnvValue('PACS_STUDY_CACHE_TTL_MS', this.DEFAULT_STUDY_CACHE_TTL_MS);
    const cacheKey = [
      normalizedPatientId,
      this.normalizeDateOnly(examDate),
      this.normalizeSearchText(examName)
    ].join('|');

    return this.withStudyCache(cacheKey, cacheTtlMs, async () => {
      const studies = await this.findStudiesByPatientId(normalizedPatientId);
      if (studies.length === 0) {
        throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'Studi radiologi pasien tidak ditemukan di PACS');
      }

      const matchedStudy = this.pickMatchingStudy(studies, examDate, examName);
      if (!matchedStudy?.study_instance_uid) {
        throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'Studi radiologi yang cocok tidak ditemukan di PACS');
      }

      return matchedStudy;
    });
  }

  static buildViewerLinkLabel(noRawat) {
    const normalizedNoRawat = String(noRawat || '').trim();
    // label muncul di audit PACS: pakai nomor rawat saja, jangan nama pasien.
    return normalizedNoRawat ? `SIMRS-EMR no_rawat=${normalizedNoRawat}` : 'SIMRS-EMR';
  }

  static async createViewerLink(studyInstanceUid, { noRawat, seriesUid, expiresMinutes } = {}) {
    const normalizedStudyUid = String(studyInstanceUid || '').trim();
    if (!normalizedStudyUid) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'StudyInstanceUID PACS belum tersedia');
    }

    const requestedTtl = Number(expiresMinutes);
    const ttlMinutes = Number.isFinite(requestedTtl) && requestedTtl > 0
      ? Math.round(requestedTtl)
      : this.getPositiveIntegerEnvValue('PACS_VIEWER_LINK_TTL_MINUTES', this.DEFAULT_VIEWER_LINK_TTL_MINUTES);

    const normalizedSeriesUid = String(seriesUid || '').trim();
    const params = new URLSearchParams();
    if (normalizedSeriesUid) {
      params.set('series_uid', normalizedSeriesUid);
    }

    const queryString = params.toString();
    const label = this.buildViewerLinkLabel(noRawat);

    const response = await this.authorizedFetch(
      `/api/v1/viewer-links/studies/${encodeURIComponent(normalizedStudyUid)}${queryString ? `?${queryString}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify({
          label,
          expires_minutes: ttlMinutes
        })
      }
    );

    const payload = await response.json().catch(() => null);
    if (!payload?.url) {
      throw this.createError(PACS_ERROR_CODES.REQUEST_FAILED, 'PACS tidak mengembalikan URL viewer');
    }

    return {
      token: String(payload.token || ''),
      url: String(payload.url),
      study_instance_uid: String(payload.study_instance_uid || normalizedStudyUid),
      series_instance_uid: payload.series_instance_uid || null,
      expires_at: String(payload.expires_at || ''),
      label: String(payload.label || label)
    };
  }

  /**
   * Daftar series milik satu studi. Dipakai untuk menampilkan gambar inline
   * langsung dari PACS (modality CT/MR tidak lagi dikirim ke Orthanc).
   */
  static async listStudySeries(studyInstanceUid, limit = this.DEFAULT_SERIES_LIST_LIMIT) {
    const normalizedStudyUid = String(studyInstanceUid || '').trim();
    if (!normalizedStudyUid) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'StudyInstanceUID PACS belum tersedia');
    }

    const normalizedLimit = Math.max(
      1,
      Number.parseInt(String(limit || ''), 10) || this.DEFAULT_SERIES_LIST_LIMIT
    );
    const cacheTtlMs = this.getPositiveIntegerEnvValue('PACS_STUDY_CACHE_TTL_MS', this.DEFAULT_STUDY_CACHE_TTL_MS);

    return this.withCache({
      cacheStore: this.seriesCache,
      inFlightStore: this.seriesInFlight,
      cacheKey: `series|${normalizedStudyUid}|${normalizedLimit}`,
      ttlMs: cacheTtlMs,
      factory: async () => {
        const params = new URLSearchParams({ limit: String(normalizedLimit) });
        const response = await this.authorizedFetch(
          `/api/v1/studies/${encodeURIComponent(normalizedStudyUid)}/series?${params.toString()}`
        );
        const payload = await response.json().catch(() => null);

        return Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];
      }
    });
  }

  static async listSeriesInstances(seriesInstanceUid, limit = this.DEFAULT_INSTANCE_LIST_LIMIT) {
    const normalizedSeriesUid = String(seriesInstanceUid || '').trim();
    if (!normalizedSeriesUid) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'SeriesInstanceUID PACS belum tersedia');
    }

    const normalizedLimit = Math.max(
      1,
      Number.parseInt(String(limit || ''), 10) || this.DEFAULT_INSTANCE_LIST_LIMIT
    );
    const cacheTtlMs = this.getPositiveIntegerEnvValue('PACS_STUDY_CACHE_TTL_MS', this.DEFAULT_STUDY_CACHE_TTL_MS);

    return this.withCache({
      cacheStore: this.seriesCache,
      inFlightStore: this.seriesInFlight,
      cacheKey: `instances|${normalizedSeriesUid}|${normalizedLimit}`,
      ttlMs: cacheTtlMs,
      factory: async () => {
        const params = new URLSearchParams({ limit: String(normalizedLimit) });
        const response = await this.authorizedFetch(
          `/api/v1/series/${encodeURIComponent(normalizedSeriesUid)}/instances?${params.toString()}`
        );
        const payload = await response.json().catch(() => null);

        return Array.isArray(payload?.instances) ? payload.instances.filter(Boolean) : [];
      }
    });
  }

  /**
   * Ambil byte gambar satu instance dari PACS. Endpoint render menerima
   * Authorization: Bearer (berbeda dengan /dicom-web/* yang butuh cookie).
   * Hasilnya diproksi backend supaya token tidak pernah sampai ke browser.
   */
  static async fetchInstanceImage(instanceUid, maxSize = 512) {
    const normalizedInstanceUid = String(instanceUid || '').trim();
    if (!normalizedInstanceUid) {
      throw this.createError(PACS_ERROR_CODES.NOT_FOUND, 'SOPInstanceUID PACS belum tersedia');
    }

    const normalizedSize = Math.min(Math.max(Number.parseInt(String(maxSize || ''), 10) || 512, 64), 4096);
    const params = new URLSearchParams({
      max_size: String(normalizedSize),
      format: 'jpeg'
    });

    const response = await this.authorizedFetch(
      `/api/v1/instances/${encodeURIComponent(normalizedInstanceUid)}/render?${params.toString()}`,
      { headers: { Accept: 'image/*' } }
    );
    const arrayBuffer = await response.arrayBuffer();

    return {
      contentType: response.headers.get('content-type') || 'image/jpeg',
      buffer: Buffer.from(arrayBuffer)
    };
  }
}

export default PacsClientService;
export { PACS_ERROR_CODES };
