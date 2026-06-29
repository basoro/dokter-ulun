import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.resolve(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'crud-audit.jsonl');
const MAX_DEPTH = 4;
const MAX_ARRAY_LENGTH = 20;
const MAX_STRING_LENGTH = 1000;

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'otp',
  'token',
  'authorization',
  'apikey',
  'api_key',
  'secret',
  'access_token',
  'refresh_token'
]);

let ensureStoragePromise = null;

const truncateString = (value) => {
  const text = String(value ?? '');
  return text.length > MAX_STRING_LENGTH
    ? `${text.slice(0, MAX_STRING_LENGTH)}...[truncated]`
    : text;
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

const sanitizeValue = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_DEPTH) {
    return '[max-depth-reached]';
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1, seen));

    if (value.length > MAX_ARRAY_LENGTH) {
      sanitizedItems.push(`[${value.length - MAX_ARRAY_LENGTH} item lainnya dipotong]`);
    }

    return sanitizedItems;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);
    const output = {};

    Object.entries(value).forEach(([key, entry]) => {
      const normalizedKey = normalizeKey(key);
      if (SENSITIVE_KEYS.has(normalizedKey)) {
        output[key] = '[redacted]';
        return;
      }

      output[key] = sanitizeValue(entry, depth + 1, seen);
    });

    seen.delete(value);
    return output;
  }

  return truncateString(value);
};

const getFirstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const buildActor = (req, payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    actor_id: getFirstNonEmpty(
      req?.headers?.['x-user-id'],
      req?.headers?.['x-username'],
      source.userId,
      source.id_user,
      source.username,
      source.user,
      source.nip,
      source.kd_dokter,
      source.doctorId
    ),
    actor_name: getFirstNonEmpty(
      req?.headers?.['x-user-name'],
      source.doctorName,
      source.nm_dokter,
      source.dokter,
      source.nama,
      source.nama_dokter,
      source.dokter_perujuk,
      source.username
    )
  };
};

const buildReference = (req, payload, meta = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    no_rawat: getFirstNonEmpty(
      meta.no_rawat,
      req?.params?.no_rawat,
      req?.query?.no_rawat,
      source.no_rawat
    ),
    no_rkm_medis: getFirstNonEmpty(
      meta.no_rkm_medis,
      req?.params?.no_rkm_medis,
      req?.query?.no_rkm_medis,
      source.no_rkm_medis
    ),
    reference_id: getFirstNonEmpty(
      meta.reference_id,
      req?.params?.id,
      req?.query?.id,
      source.id,
      source.no_resep,
      source.noorder,
      source.noteId,
      source.executionId,
      source.patientId
    )
  };
};

export const inferCrudAction = (value, fallback = 'create') => {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (['create', 'created', 'insert', 'inserted'].includes(normalized)) {
    return 'create';
  }

  if (['update', 'updated', 'edit', 'edited'].includes(normalized)) {
    return 'update';
  }

  if (['delete', 'deleted', 'remove', 'removed'].includes(normalized)) {
    return 'delete';
  }

  if (['upsert', 'save'].includes(normalized)) {
    return normalized;
  }

  return fallback;
};

const inferActionFromMessage = (message, fallback = 'create') => {
  const normalized = String(message || '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (normalized.includes('hapus') || normalized.includes('delete')) {
    return 'delete';
  }

  if (
    normalized.includes('update') ||
    normalized.includes('perbarui') ||
    normalized.includes('diperbarui') ||
    normalized.includes('verification') ||
    normalized.includes('verifikasi')
  ) {
    return 'update';
  }

  return fallback;
};

const parseAuditHistoryAccessUsers = () => {
  const rawValue = String(process.env.AUDIT_HISTORY_ACCESS || '').trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to parse AUDIT_HISTORY_ACCESS:', error);
    return [];
  }
};

const parseDoctorAccessAliases = () => {
  const rawValue = String(process.env.DOCTOR_ACCESS_ALIASES || '').trim();

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue).map(([doctorCode, aliases]) => [
        String(doctorCode || '').trim(),
        Array.isArray(aliases)
          ? aliases.map((alias) => String(alias || '').trim()).filter(Boolean)
          : []
      ])
    );
  } catch (error) {
    console.error('Failed to parse DOCTOR_ACCESS_ALIASES:', error);
    return {};
  }
};

const getAllowedAuditUsers = () => {
  const accessUsers = parseAuditHistoryAccessUsers();
  const aliasMap = parseDoctorAccessAliases();
  return Array.from(new Set([
    ...accessUsers,
    ...Object.keys(aliasMap),
    ...Object.values(aliasMap).flat()
  ].map((item) => String(item || '').trim()).filter(Boolean)));
};

const ensureAccess = (username) => {
  const normalizedUsername = String(username || '').trim();
  const hasAccess = Boolean(normalizedUsername) && getAllowedAuditUsers().includes(normalizedUsername);
  if (!hasAccess) {
    const error = new Error('Anda tidak memiliki akses ke riwayat audit');
    error.statusCode = 403;
    throw error;
  }
};

const hasFullAuditAccess = (username) => {
  const normalizedUsername = String(username || '').trim();
  return Boolean(normalizedUsername) && getAllowedAuditUsers().includes(normalizedUsername);
};

const ensureStorage = async () => {
  if (!ensureStoragePromise) {
    ensureStoragePromise = (async () => {
      await fs.mkdir(LOG_DIR, { recursive: true });
      try {
        await fs.access(LOG_FILE);
      } catch {
        await fs.writeFile(LOG_FILE, '', 'utf8');
      }
    })().catch((error) => {
      ensureStoragePromise = null;
      throw error;
    });
  }

  return ensureStoragePromise;
};

export const initCrudAuditStorage = async () => {
  try {
    await ensureStorage();
    console.log(`🧾 CRUD audit siap: file ${LOG_FILE}`);
  } catch (error) {
    console.error('Gagal menyiapkan storage CRUD audit:', error);
  }
};

export const getAuditHistoryAccessInfo = async (username) => {
  const normalizedUsername = String(username || '').trim();
  const fullAccess = hasFullAuditAccess(normalizedUsername);
  return {
    success: true,
    can_access: fullAccess,
    full_access: fullAccess,
    actor_scope: fullAccess ? 'all' : ''
  };
};

export const getAuditHistory = async (username, options = {}) => {
  ensureAccess(username);
  await ensureStorage();

  const fullAccess = hasFullAuditAccess(username);
  const page = Math.max(Number.parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 50, 1), 200);
  const actionFilter = String(options.action || '').trim().toLowerCase();
  const statusFilter = String(options.status || '').trim().toLowerCase();
  const entityFilter = String(options.entity || '').trim().toLowerCase();
  const searchFilter = String(options.search || '').trim().toLowerCase();

  const content = await fs.readFile(LOG_FILE, 'utf8').catch(() => '');
  const records = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse()
    .filter((entry) => {
      const actionMatch = !actionFilter || String(entry?.action || '').toLowerCase() === actionFilter;
      const statusMatch = !statusFilter || String(entry?.status || '').toLowerCase() === statusFilter;
      const entityMatch = !entityFilter || String(entry?.entity || '').toLowerCase().includes(entityFilter);
      const searchBlob = JSON.stringify(entry || {}).toLowerCase();
      const searchMatch = !searchFilter || searchBlob.includes(searchFilter);
      return actionMatch && statusMatch && entityMatch && searchMatch;
    });

  const total = records.length;
  const startIndex = (page - 1) * limit;
  const items = records.slice(startIndex, startIndex + limit);

  return {
    success: true,
    full_access: fullAccess,
    actor_scope: 'all',
    data: items,
    pagination: {
      page,
      limit,
      total,
      hasMore: startIndex + items.length < total
    }
  };
};

export const logCrudActivity = async ({
  req,
  action,
  entity,
  status = 'success',
  payload,
  result,
  error,
  meta = {}
}) => {
  try {
    await ensureStorage();

    const auditAction = inferCrudAction(
      action || result?.data?.action || result?.action || inferActionFromMessage(result?.message, 'create'),
      'create'
    );
    const sanitizedPayload = sanitizeValue(payload ?? req?.body ?? {});
    const sanitizedResult = sanitizeValue(result ?? {});
    const actor = buildActor(req, payload ?? req?.body);
    const reference = buildReference(req, payload ?? req?.body, meta);
    const entry = {
      log_id: randomUUID(),
      created_at: new Date().toISOString(),
      action: auditAction,
      entity: String(entity || '').trim() || 'unknown',
      status: String(status || 'success').trim(),
      endpoint: String(req?.originalUrl || '').trim(),
      method: String(req?.method || '').trim(),
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      no_rawat: reference.no_rawat,
      no_rkm_medis: reference.no_rkm_medis,
      reference_id: reference.reference_id,
      ip_address: getFirstNonEmpty(req?.ip, req?.socket?.remoteAddress),
      user_agent: truncateString(req?.headers?.['user-agent'] || ''),
      request_payload: sanitizedPayload,
      response_payload: sanitizedResult,
      error_message: error ? truncateString(error.message || error) : ''
    };

    await fs.appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (logError) {
    console.error('Gagal menulis CRUD audit:', logError);
  }
};
