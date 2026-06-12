import dotenv from 'dotenv';
import { executeQuery } from '../config/database.js';
import { getAccessibleDoctorCodesByPhpNative } from './doctorAccessMapping.js';

dotenv.config();

class DoctorAiAssistantService {
  constructor() {
    this.openAIApiKey = process.env.OPENAI_API_KEY;
    this.defaultSuggestions = [
      'Tampilkan data pasien saya hari ini',
      'Tampilkan data pasien saya kemarin',
      'Tampilkan data pasien saya rawat inap belum pulang',
      'Tampilkan data pasien rawat bersama saya',
      'Tampilkan data pasien rawat gabung saya',
      'Berapa pasien rawat inap saya yang belum resume?',
      'Berapa pasien rawat gabung saya?',
      'Tampilkan data pasien rawat inap saya pindah kamar',
      'Tampilkan data pasien rawat inap saya yang belum resume',
      'Tampilkan data pasien rawat inap saya yang sudah resume',
      'Tampilkan data pasien saya dari tanggal 2026-06-01 sampai 2026-06-12',
      'Carikan saya data rekam medis pasien bernama Siti Aminah',
      'Tampilkan kunjungan terakhir pasien Siti Aminah',
      'Tampilkan diagnosis pasien Siti Aminah',
      'Tampilkan resep pasien Siti Aminah',
      'Berikan saya hasil lab untuk pasien Siti Aminah tanggal 2026-06-12',
      'Berikan saya hasil radiologi pasien Siti Aminah tanggal 2026-06-12',
      'Tampilkan riwayat rawat inap pasien Siti Aminah',
      'Tampilkan laporan operasi pasien Siti Aminah',
      'Cari pasien dengan no rekam medis 000123'
    ];

    if (!this.openAIApiKey) {
      console.warn('OPENAI_API_KEY not found in environment variables');
    }
  }

  getCurrentDateWib() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    return formatter.format(now);
  }

  getRelativeDateWib(dayOffset = 0) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    return formatter.format(currentDate);
  }

  normalizeHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .slice(-12)
      .map((entry) => ({
        role: entry?.role === 'assistant' ? 'assistant' : 'user',
        message: String(entry?.message || '').trim(),
        payload: entry?.payload && typeof entry.payload === 'object' ? entry.payload : null
      }))
      .filter((entry) => entry.message || entry.payload);
  }

  extractConversationContext(history) {
    const reversedHistory = [...history].reverse();
    const context = {
      patientName: null,
      targetDate: null,
      startDate: null,
      endDate: null,
      noRawat: null,
      noRkmMedis: null,
      identifier: null,
      identifierType: null,
      careType: null,
      inpatientTab: null,
      inpatientStatus: null,
      resumeStatus: null,
      lastIntent: null
    };

    for (const entry of reversedHistory) {
      const payloadContext = entry?.payload?.context;
      const payloadIntent = entry?.payload?.intent;

      if (payloadContext && typeof payloadContext === 'object') {
        if (!context.patientName && payloadContext.patientName) {
          context.patientName = String(payloadContext.patientName).trim();
        }
        if (!context.targetDate && payloadContext.targetDate) {
          context.targetDate = String(payloadContext.targetDate).trim();
        }
        if (!context.startDate && payloadContext.startDate) {
          context.startDate = String(payloadContext.startDate).trim();
        }
        if (!context.endDate && payloadContext.endDate) {
          context.endDate = String(payloadContext.endDate).trim();
        }
        if (!context.noRawat && payloadContext.noRawat) {
          context.noRawat = String(payloadContext.noRawat).trim();
        }
        if (!context.noRkmMedis && payloadContext.noRkmMedis) {
          context.noRkmMedis = String(payloadContext.noRkmMedis).trim();
        }
        if (!context.identifier && payloadContext.identifier) {
          context.identifier = String(payloadContext.identifier).trim();
        }
        if (!context.identifierType && payloadContext.identifierType) {
          context.identifierType = String(payloadContext.identifierType).trim();
        }
        if (!context.careType && payloadContext.careType) {
          context.careType = String(payloadContext.careType).trim();
        }
        if (!context.inpatientTab && payloadContext.inpatientTab) {
          context.inpatientTab = String(payloadContext.inpatientTab).trim();
        }
        if (!context.inpatientStatus && payloadContext.inpatientStatus) {
          context.inpatientStatus = String(payloadContext.inpatientStatus).trim();
        }
        if (!context.resumeStatus && payloadContext.resumeStatus) {
          context.resumeStatus = String(payloadContext.resumeStatus).trim();
        }
        if (!context.lastIntent && payloadContext.lastIntent) {
          context.lastIntent = String(payloadContext.lastIntent).trim();
        }
      }

      if (!context.lastIntent && payloadIntent) {
        context.lastIntent = String(payloadIntent).trim();
      }

      if (
        context.patientName &&
        context.targetDate &&
        context.startDate &&
        context.endDate &&
        context.noRawat &&
        context.noRkmMedis &&
        context.careType &&
        context.inpatientTab &&
        context.inpatientStatus &&
        context.resumeStatus &&
        context.lastIntent
      ) {
        break;
      }
    }

    return context;
  }

  isPatientReferenceMessage(message) {
    const normalized = String(message || '').toLowerCase();
    return /pasien ini|pasien tadi|yang sama|dia\b|beliau|kunjungan terakhirnya|labnya|radiologinya|diagnosisnya|resepnya|operasinya|rawat inapnya/.test(normalized);
  }

  isDateReferenceMessage(message) {
    const normalized = String(message || '').toLowerCase();
    return /tanggal yang sama|hari yang sama|tanggal tadi|tanggal itu|tgl yang sama|hari itu/.test(normalized);
  }

  planNeedsPatient(intent) {
    return [
      'patient_medical_record_search',
      'lab_results_by_patient_date',
      'patient_last_visit_summary',
      'diagnosis_history_by_patient',
      'prescription_history_by_patient',
      'radiology_results_by_patient_date',
      'inpatient_history_by_patient',
      'operation_report_by_patient'
    ].includes(intent);
  }

  planNeedsDate(intent) {
    return ['lab_results_by_patient_date', 'radiology_results_by_patient_date'].includes(intent);
  }

  resolvePlanWithContext(plan, message, conversationContext) {
    const resolvedPlan = {
      ...plan
    };

    if (!resolvedPlan.patientName) {
      const shouldUseContextPatient =
        this.planNeedsPatient(resolvedPlan.intent) &&
        conversationContext.patientName &&
        (this.isPatientReferenceMessage(message) || Boolean(conversationContext.patientName));

      if (shouldUseContextPatient) {
        resolvedPlan.patientName = conversationContext.patientName;
      }
    }

    if (!resolvedPlan.targetDate) {
      const shouldUseContextDate =
        this.planNeedsDate(resolvedPlan.intent) &&
        conversationContext.targetDate &&
        (this.isDateReferenceMessage(message) || this.isPatientReferenceMessage(message));

      if (shouldUseContextDate) {
        resolvedPlan.targetDate = conversationContext.targetDate;
      }
    }

    if (!resolvedPlan.startDate && conversationContext.startDate) {
      resolvedPlan.startDate = conversationContext.startDate;
    }

    if (!resolvedPlan.endDate && conversationContext.endDate) {
      resolvedPlan.endDate = conversationContext.endDate;
    }

    if (!resolvedPlan.patientIdentifier && conversationContext.identifier) {
      resolvedPlan.patientIdentifier = conversationContext.identifier;
      resolvedPlan.identifierType = conversationContext.identifierType;
    }

    if (!resolvedPlan.careType && conversationContext.careType) {
      resolvedPlan.careType = conversationContext.careType;
    }

    if (!resolvedPlan.inpatientTab && conversationContext.inpatientTab) {
      resolvedPlan.inpatientTab = conversationContext.inpatientTab;
    }

    if (!resolvedPlan.inpatientStatus && conversationContext.inpatientStatus) {
      resolvedPlan.inpatientStatus = conversationContext.inpatientStatus;
    }

    if (!resolvedPlan.resumeStatus && conversationContext.resumeStatus) {
      resolvedPlan.resumeStatus = conversationContext.resumeStatus;
    }

    return this.applyPlanMessageDefaults(resolvedPlan, message);
  }

  applyPlanMessageDefaults(plan, message) {
    const normalizedMessage = String(message || '').toLowerCase();
    const normalizedPlan = {
      ...plan
    };

    if (!normalizedPlan.targetDate && !normalizedPlan.startDate && !normalizedPlan.endDate) {
      if (/\bkemarin\b/.test(normalizedMessage)) {
        normalizedPlan.targetDate = this.getRelativeDateWib(-1);
      } else if (/\bhari ini\b/.test(normalizedMessage)) {
        normalizedPlan.targetDate = this.getCurrentDateWib();
      }
    }

    if (normalizedPlan.careType === 'all') {
      if (/rawat inap|ranap/.test(normalizedMessage)) {
        normalizedPlan.careType = 'ranap';
      } else if (/rawat jalan|ralan/.test(normalizedMessage)) {
        normalizedPlan.careType = 'ralan';
      }
    }

    if (!normalizedPlan.inpatientStatus) {
      if (/belum pulang|masih dirawat|masih di rawat/.test(normalizedMessage)) {
        normalizedPlan.inpatientStatus = 'masih-dirawat';
      } else if (/sudah pulang/.test(normalizedMessage)) {
        normalizedPlan.inpatientStatus = 'sudah-pulang';
      }
    }

    if (!normalizedPlan.resumeStatus) {
      if (/belum resume|resume belum|resume medis belum/.test(normalizedMessage)) {
        normalizedPlan.resumeStatus = 'belum_resume';
      } else if (/sudah resume|resume sudah|sudah ada resume/.test(normalizedMessage)) {
        normalizedPlan.resumeStatus = 'sudah_resume';
      }
    }

    if (!normalizedPlan.inpatientTab) {
      if (/rawat bersama|raber|konsul/.test(normalizedMessage)) {
        normalizedPlan.inpatientTab = 'rawat-bersama';
      } else if (/rawat gabung/.test(normalizedMessage)) {
        normalizedPlan.inpatientTab = 'rawat-gabung';
      }
    }

    if ((normalizedPlan.inpatientStatus || normalizedPlan.resumeStatus || normalizedPlan.inpatientTab) && normalizedPlan.careType === 'all') {
      normalizedPlan.careType = 'ranap';
    }

    return normalizedPlan;
  }

  buildDateFilterClause(plan, params, column = 'rp.tgl_registrasi', defaultToToday = true) {
    if (plan.startDate && plan.endDate) {
      params.push(plan.startDate, plan.endDate);
      return `AND DATE(${column}) BETWEEN ? AND ?`;
    }

    if (plan.targetDate) {
      params.push(plan.targetDate);
      return `AND DATE(${column}) = ?`;
    }

    if (defaultToToday) {
      const today = this.getCurrentDateWib();
      params.push(today);
      return `AND DATE(${column}) = ?`;
    }

    return '';
  }

  buildInpatientStatusClause(plan) {
    if (plan.careType !== 'ranap' || !plan.inpatientStatus || plan.inpatientStatus === 'all') {
      return '';
    }

    if (plan.inpatientStatus === 'masih-dirawat') {
      return `AND EXISTS (
        SELECT 1
        FROM kamar_inap ki
        WHERE ki.no_rawat = rp.no_rawat
          AND COALESCE(ki.stts_pulang, '') = '-'
      )`;
    }

    if (plan.inpatientStatus === 'sudah-pulang') {
      return `AND EXISTS (
        SELECT 1
        FROM kamar_inap ki
        WHERE ki.no_rawat = rp.no_rawat
          AND COALESCE(ki.stts_pulang, '') NOT IN ('', '-', 'Pindah Kamar')
      )`;
    }

    if (plan.inpatientStatus === 'pindah-kamar') {
      return `AND EXISTS (
        SELECT 1
        FROM kamar_inap ki
        WHERE ki.no_rawat = rp.no_rawat
          AND COALESCE(ki.stts_pulang, '') = 'Pindah Kamar'
      )`;
    }

    return '';
  }

  buildInClausePlaceholders(values = []) {
    return values.map(() => '?').join(', ');
  }

  getDischargeDateFilterColumn(accessibleDoctorCodes = []) {
    return accessibleDoctorCodes.includes('DR00016') ? 'ki.tgl_masuk' : 'ki.tgl_keluar';
  }

  buildKamarInapStatusClause(plan) {
    if (plan.careType !== 'ranap' || !plan.inpatientStatus || plan.inpatientStatus === 'all') {
      return '';
    }

    if (plan.inpatientStatus === 'masih-dirawat') {
      return `AND COALESCE(ki.stts_pulang, '') = '-'`;
    }

    if (plan.inpatientStatus === 'sudah-pulang') {
      return `AND COALESCE(ki.stts_pulang, '') NOT IN ('', '-', 'Pindah Kamar')`;
    }

    if (plan.inpatientStatus === 'pindah-kamar') {
      return `AND COALESCE(ki.stts_pulang, '') = 'Pindah Kamar'`;
    }

    return '';
  }

  buildResumeStatusClause(plan) {
    if (!plan.resumeStatus || plan.resumeStatus === 'all') {
      return '';
    }

    if (plan.resumeStatus === 'sudah_resume') {
      return `AND rpr.no_rawat IS NOT NULL`;
    }

    if (plan.resumeStatus === 'belum_resume') {
      return `AND rpr.no_rawat IS NULL`;
    }

    return '';
  }

  buildPatientSearchClause(
    plan,
    params,
    {
      patientAlias = 'p',
      noRawatColumn = 'rp.no_rawat',
      noRkmMedisColumn = 'p.no_rkm_medis',
      noKtpColumn = 'p.no_ktp'
    } = {}
  ) {
    const clauses = [];

    if (plan.patientName) {
      params.push(`%${plan.patientName}%`);
      clauses.push(`${patientAlias}.nm_pasien LIKE ?`);
    }

    if (plan.patientIdentifier) {
      const identifierType = String(plan.identifierType || '').trim().toLowerCase();
      if (identifierType === 'no_rawat') {
        params.push(plan.patientIdentifier);
        clauses.push(`${noRawatColumn} = ?`);
      } else if (identifierType === 'no_ktp') {
        params.push(plan.patientIdentifier);
        clauses.push(`${noKtpColumn} = ?`);
      } else {
        params.push(plan.patientIdentifier);
        clauses.push(`${noRkmMedisColumn} = ?`);
      }
    }

    if (clauses.length === 0) {
      return '';
    }

    return clauses.map((clause) => `AND ${clause}`).join('\n        ');
  }

  formatPatientListPeriod(plan) {
    if (plan.startDate && plan.endDate) {
      return `rentang tanggal ${plan.startDate} sampai ${plan.endDate}`;
    }

    if (plan.targetDate) {
      return `tanggal ${plan.targetDate}`;
    }

    if (plan.careType === 'ranap' && plan.inpatientStatus === 'masih-dirawat') {
      return 'saat ini';
    }

    if (plan.careType === 'ranap') {
      return 'seluruh periode data';
    }

    return `tanggal ${this.getCurrentDateWib()}`;
  }

  buildContextualSuggestions({ context = {}, intent, suggestions = [] }) {
    const contextualSuggestions = [];
    const normalizedIntent = String(intent || context.lastIntent || '').trim();
    const patientLabel = context.patientName || 'pasien ini';
    const hasPatientContext = Boolean(context.patientName || context.noRawat || context.noRkmMedis);
    const hasDateRange = Boolean(context.startDate && context.endDate);
    const hasTargetDate = Boolean(context.targetDate);

    if (context.careType === 'ranap' && context.inpatientStatus === 'masih-dirawat') {
      contextualSuggestions.push(
        'Tampilkan data pasien saya rawat inap belum pulang',
        'Berapa pasien rawat inap saya yang belum pulang?',
        'Tampilkan data pasien saya rawat inap dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.careType === 'ranap' && context.inpatientStatus === 'pindah-kamar') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat inap saya pindah kamar',
        'Berapa pasien rawat inap saya pindah kamar?',
        'Tampilkan data pasien rawat inap saya pindah kamar dari tanggal [tanggal awal] sampai [tanggal akhir]',
        'Tampilkan data pasien rawat inap saya pindah kamar yang belum resume'
      );
    }

    if (context.inpatientTab === 'rawat-bersama') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat bersama saya',
        'Berapa pasien rawat bersama saya?',
        'Tampilkan data pasien rawat bersama saya yang sudah pulang',
        'Tampilkan data pasien rawat bersama saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.inpatientTab === 'rawat-gabung') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat gabung saya',
        'Berapa pasien rawat gabung saya?',
        'Tampilkan data pasien rawat gabung saya yang belum resume',
        'Tampilkan data pasien rawat gabung saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.careType === 'ranap' && context.resumeStatus === 'belum_resume') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat inap saya yang belum resume',
        'Berapa pasien rawat inap saya yang belum resume?',
        'Tampilkan data pasien rawat inap saya yang belum resume dan belum pulang',
        'Tampilkan data pasien rawat inap saya yang belum resume dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.careType === 'ranap' && context.resumeStatus === 'sudah_resume') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat inap saya yang sudah resume',
        'Berapa pasien rawat inap saya yang sudah resume?',
        'Tampilkan data pasien rawat inap saya yang sudah resume dan sudah pulang',
        'Tampilkan data pasien rawat inap saya yang sudah resume dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.careType === 'ranap' && context.inpatientStatus === 'sudah-pulang') {
      contextualSuggestions.push(
        'Tampilkan data pasien saya rawat inap sudah pulang',
        'Berapa pasien rawat inap saya yang sudah pulang?',
        'Tampilkan data pasien saya rawat inap dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (context.careType === 'ralan') {
      contextualSuggestions.push(
        'Tampilkan data pasien saya rawat jalan hari ini',
        'Berapa pasien rawat jalan saya untuk hari ini?',
        'Tampilkan data pasien saya rawat jalan dari tanggal [tanggal awal] sampai [tanggal akhir]'
      );
    }

    if (hasDateRange) {
      contextualSuggestions.push(
        'Berapa pasien saya pada rentang tanggal ini?',
        'Tampilkan data pasien saya rawat inap pada rentang tanggal ini',
        'Tampilkan data pasien saya rawat jalan pada rentang tanggal ini'
      );
    } else if (hasTargetDate) {
      contextualSuggestions.push(
        'Berapa pasien saya pada tanggal ini?',
        'Tampilkan data pasien saya rawat inap pada tanggal ini',
        'Tampilkan data pasien saya rawat jalan pada tanggal ini'
      );
    }

    if (hasPatientContext) {
      contextualSuggestions.push(
        `Tampilkan kunjungan terakhir ${patientLabel}`,
        `Tampilkan diagnosis ${patientLabel}`,
        `Tampilkan resep ${patientLabel}`
      );

      if (hasTargetDate || hasDateRange) {
        contextualSuggestions.push(
          `Berikan saya hasil lab untuk ${patientLabel} tanggal yang sama`,
          `Berikan saya hasil radiologi ${patientLabel} tanggal yang sama`
        );
      } else {
        contextualSuggestions.push(
          `Berikan saya hasil lab untuk ${patientLabel} tanggal [tanggal]`,
          `Berikan saya hasil radiologi ${patientLabel} tanggal [tanggal]`
        );
      }
    }

    if (normalizedIntent === 'today_patient_list') {
      contextualSuggestions.push(
        'Berapa pasien saya untuk hari ini?',
        'Tampilkan data pasien saya kemarin'
      );
    }

    if (normalizedIntent === 'inpatient_operational_summary') {
      contextualSuggestions.push(
        'Tampilkan data pasien rawat inap saya yang belum resume',
        'Tampilkan data pasien rawat inap saya pindah kamar',
        'Tampilkan data pasien rawat bersama saya',
        'Tampilkan data pasien rawat gabung saya'
      );
    }

    if (normalizedIntent === 'patient_last_visit_summary' && hasPatientContext) {
      contextualSuggestions.push(
        `Tampilkan riwayat rawat inap ${patientLabel}`,
        `Tampilkan laporan operasi ${patientLabel}`
      );
    }

    return Array.from(
      new Set(
        [...contextualSuggestions, ...suggestions, ...this.defaultSuggestions]
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  shouldUseNaturalSqlFallback(plan = {}) {
    const normalizedIntent = String(plan.intent || '').trim();
    const confidence = Number(plan.confidence || 0);

    return normalizedIntent === 'unsupported' || confidence < 0.45;
  }

  getNaturalSqlAllowedDatasets() {
    return [
      'doctor_visits',
      'doctor_diagnoses',
      'doctor_prescriptions',
      'doctor_lab_results',
      'doctor_radiology_results',
      'doctor_inpatient_history',
      'doctor_operations'
    ];
  }

  getNaturalSqlDatasetReference() {
    return `
Dataset yang boleh dipakai:
1. doctor_visits
   Kolom: no_rawat, tgl_registrasi, no_reg, status_lanjut, stts, kd_dokter, kd_poli, nm_poli, no_rkm_medis, no_ktp, nm_pasien, jk, tgl_lahir
2. doctor_diagnoses
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tgl_registrasi, nm_poli, kd_dokter, kd_penyakit, nm_penyakit, prioritas, status
3. doctor_prescriptions
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tgl_registrasi, nm_poli, no_resep, tanggal_resep, jam_resep, nama_brng, jml, aturan_pakai, kd_dokter
4. doctor_lab_results
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tgl_registrasi, nm_poli, tgl_periksa, jam, nm_perawatan, pemeriksaan, hasil, nilai_rujukan, keterangan
5. doctor_radiology_results
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tgl_registrasi, nm_poli, tgl_periksa, jam, nm_perawatan, hasil
6. doctor_inpatient_history
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tgl_registrasi, nm_poli, tgl_masuk, jam_masuk, tgl_keluar, jam_keluar, stts_pulang, kd_kamar, kelas, nm_bangsal, status_resume, kd_dokter
7. doctor_operations
   Kolom: no_rawat, no_rkm_medis, nm_pasien, tanggal_op, nm_op, hasil_op, pre_op, post_op, kd_dokter
    `.trim();
  }

  buildNaturalSqlBaseQuery(accessibleDoctorCodes = []) {
    const normalizedDoctorCodes = Array.isArray(accessibleDoctorCodes) && accessibleDoctorCodes.length > 0
      ? accessibleDoctorCodes
      : [];

    if (normalizedDoctorCodes.length === 0) {
      throw new Error('Kode dokter untuk natural SQL tidak tersedia');
    }

    const params = [];
    const buildDoctorScopeClause = () => {
      params.push(...normalizedDoctorCodes);
      return this.buildInClausePlaceholders(normalizedDoctorCodes);
    };

    const visitDoctorPlaceholders = buildDoctorScopeClause();
    const prescriptionDoctorPlaceholders = buildDoctorScopeClause();
    const inpatientDoctorPlaceholders = buildDoctorScopeClause();
    const operationDoctorPlaceholders = buildDoctorScopeClause();

    const sql = `
      WITH
      doctor_visits AS (
        SELECT
          rp.no_rawat,
          DATE(rp.tgl_registrasi) AS tgl_registrasi,
          rp.no_reg,
          rp.status_lanjut,
          rp.stts,
          rp.kd_dokter,
          rp.kd_poli,
          pol.nm_poli,
          p.no_rkm_medis,
          p.no_ktp,
          p.nm_pasien,
          p.jk,
          p.tgl_lahir
        FROM reg_periksa rp
        INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
        WHERE rp.kd_dokter IN (${visitDoctorPlaceholders})
      ),
      doctor_diagnoses AS (
        SELECT
          dv.no_rawat,
          dv.no_rkm_medis,
          dv.nm_pasien,
          dv.tgl_registrasi,
          dv.nm_poli,
          dv.kd_dokter,
          dp.kd_penyakit,
          py.nm_penyakit,
          dp.prioritas,
          dp.status
        FROM doctor_visits dv
        INNER JOIN diagnosa_pasien dp ON dp.no_rawat = dv.no_rawat
        LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
      ),
      doctor_prescriptions AS (
        SELECT
          dv.no_rawat,
          dv.no_rkm_medis,
          dv.nm_pasien,
          dv.tgl_registrasi,
          dv.nm_poli,
          ro.no_resep,
          CASE
            WHEN ro.tgl_perawatan IS NULL OR ro.tgl_perawatan = '0000-00-00' THEN ro.tgl_peresepan
            ELSE ro.tgl_perawatan
          END AS tanggal_resep,
          CASE
            WHEN ro.jam IS NULL OR ro.jam = '00:00:00' THEN ro.jam_peresepan
            ELSE ro.jam
          END AS jam_resep,
          db.nama_brng,
          dpo.jml,
          COALESCE(ap.aturan, '') AS aturan_pakai,
          ro.kd_dokter
        FROM doctor_visits dv
        INNER JOIN resep_obat ro ON ro.no_rawat = dv.no_rawat
        LEFT JOIN detail_pemberian_obat dpo
          ON dpo.tgl_perawatan = ro.tgl_perawatan
          AND dpo.jam = ro.jam
        LEFT JOIN databarang db ON db.kode_brng = dpo.kode_brng
        LEFT JOIN aturan_pakai ap
          ON ap.no_rawat = ro.no_rawat
          AND ap.kode_brng = dpo.kode_brng
          AND ap.tgl_perawatan = ro.tgl_perawatan
          AND ap.jam = ro.jam
        WHERE ro.kd_dokter IN (${prescriptionDoctorPlaceholders})
      ),
      doctor_lab_results AS (
        SELECT
          dv.no_rawat,
          dv.no_rkm_medis,
          dv.nm_pasien,
          dv.tgl_registrasi,
          dv.nm_poli,
          DATE(pl.tgl_periksa) AS tgl_periksa,
          pl.jam,
          jp.nm_perawatan,
          COALESCE(tl.Pemeriksaan, '') AS pemeriksaan,
          COALESCE(dpl.nilai, '') AS hasil,
          COALESCE(dpl.nilai_rujukan, '') AS nilai_rujukan,
          COALESCE(dpl.keterangan, '') AS keterangan
        FROM doctor_visits dv
        INNER JOIN periksa_lab pl ON pl.no_rawat = dv.no_rawat
        LEFT JOIN jns_perawatan_lab jp ON jp.kd_jenis_prw = pl.kd_jenis_prw
        LEFT JOIN detail_periksa_lab dpl
          ON dpl.no_rawat = pl.no_rawat
          AND dpl.kd_jenis_prw = pl.kd_jenis_prw
          AND dpl.tgl_periksa = pl.tgl_periksa
          AND dpl.jam = pl.jam
        LEFT JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
      ),
      doctor_radiology_results AS (
        SELECT
          dv.no_rawat,
          dv.no_rkm_medis,
          dv.nm_pasien,
          dv.tgl_registrasi,
          dv.nm_poli,
          DATE(pr.tgl_periksa) AS tgl_periksa,
          pr.jam,
          jpr.nm_perawatan,
          COALESCE(hr.hasil, '') AS hasil
        FROM doctor_visits dv
        INNER JOIN periksa_radiologi pr ON pr.no_rawat = dv.no_rawat
        LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = pr.kd_jenis_prw
        LEFT JOIN hasil_radiologi hr ON hr.no_rawat = pr.no_rawat AND hr.tgl_periksa = pr.tgl_periksa
      ),
      doctor_inpatient_history AS (
        SELECT DISTINCT
          ki.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          DATE(rp.tgl_registrasi) AS tgl_registrasi,
          pol.nm_poli,
          ki.tgl_masuk,
          ki.jam_masuk,
          ki.tgl_keluar,
          ki.jam_keluar,
          COALESCE(ki.stts_pulang, '') AS stts_pulang,
          ki.kd_kamar,
          k.kelas,
          b.nm_bangsal,
          CASE
            WHEN rpr.no_rawat IS NULL THEN 'belum_resume'
            ELSE 'sudah_resume'
          END AS status_resume,
          dr.kd_dokter
        FROM kamar_inap ki
        INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
        INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        INNER JOIN dpjp_ranap dr ON dr.no_rawat = ki.no_rawat
        LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
        LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar
        LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
        LEFT JOIN resume_pasien_ranap rpr ON rpr.no_rawat = ki.no_rawat
        WHERE dr.kd_dokter IN (${inpatientDoctorPlaceholders})
      ),
      doctor_operations AS (
        SELECT
          lo.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          lo.tanggal_op,
          lo.nm_op,
          lo.hasil_op,
          lo.pre_op,
          lo.post_op,
          lo.kd_dokter
        FROM mlite_lap_op lo
        INNER JOIN reg_periksa rp ON rp.no_rawat = lo.no_rawat
        INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        WHERE lo.kd_dokter IN (${operationDoctorPlaceholders})
          AND lo.deleted_at IS NULL
      )
    `.trim();

    return {
      sql,
      params
    };
  }

  normalizeNaturalSql(sql = '') {
    return String(sql || '').replace(/\s+/g, ' ').trim();
  }

  sanitizeNaturalSqlParams(params) {
    if (!Array.isArray(params)) {
      return [];
    }

    return params.slice(0, 30).map((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }

      return String(value).slice(0, 200);
    });
  }

  applyNaturalSqlLimit(sql) {
    if (/\blimit\s+\d+\b/i.test(sql)) {
      return sql.replace(/\blimit\s+(\d+)\b/i, (_, limitValue) => {
        const normalizedLimit = Math.min(parseInt(limitValue, 10) || 100, 100);
        return `LIMIT ${normalizedLimit}`;
      });
    }

    return `${sql} LIMIT 100`;
  }

  validateNaturalSqlQuery(sql, params = []) {
    const normalizedSql = this.normalizeNaturalSql(sql);

    if (!normalizedSql) {
      throw new Error('Natural SQL kosong');
    }

    if (!/^select\b/i.test(normalizedSql)) {
      throw new Error('Natural SQL hanya boleh menggunakan SELECT');
    }

    if (normalizedSql.length > 4000) {
      throw new Error('Natural SQL terlalu panjang');
    }

    if (/;|--|\/\*|\*\/|#/i.test(normalizedSql)) {
      throw new Error('Natural SQL mengandung token yang tidak diizinkan');
    }

    if (/\b(insert|update|delete|drop|alter|truncate|replace|create|grant|revoke|call|execute|handler|outfile|dumpfile|load_file|benchmark|sleep|information_schema|mysql\.|sys\.)\b/i.test(normalizedSql)) {
      throw new Error('Natural SQL mengandung keyword yang tidak diizinkan');
    }

    const allowedDatasets = new Set(this.getNaturalSqlAllowedDatasets());
    const datasetMatches = Array.from(normalizedSql.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/gi));

    if (datasetMatches.length === 0) {
      throw new Error('Natural SQL harus membaca dari dataset yang diizinkan');
    }

    for (const match of datasetMatches) {
      const datasetName = String(match[1] || '').trim().toLowerCase();
      if (!allowedDatasets.has(datasetName)) {
        throw new Error(`Dataset "${datasetName}" tidak diizinkan`);
      }
    }

    const placeholderCount = (normalizedSql.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error('Jumlah parameter natural SQL tidak sesuai');
    }

    return this.applyNaturalSqlLimit(normalizedSql);
  }

  async createNaturalSqlPlan({ message, username, doctorName, conversationContext, normalizedHistory }) {
    const today = this.getCurrentDateWib();
    const historySummary = normalizedHistory
      .slice(-6)
      .map((entry) => `${entry.role === 'assistant' ? 'AI' : 'Dokter'}: ${entry.message}`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `
Anda adalah penerjemah bahasa natural ke query MySQL SELECT yang aman untuk asisten dokter.
Tanggal hari ini di WIB adalah ${today}.
Dokter login: ${doctorName || username} (${username}).

Konteks aktif:
- patientName: ${conversationContext.patientName || 'null'}
- targetDate: ${conversationContext.targetDate || 'null'}
- startDate: ${conversationContext.startDate || 'null'}
- endDate: ${conversationContext.endDate || 'null'}
- noRawat: ${conversationContext.noRawat || 'null'}
- noRkmMedis: ${conversationContext.noRkmMedis || 'null'}
- identifier: ${conversationContext.identifier || 'null'}
- identifierType: ${conversationContext.identifierType || 'null'}

Riwayat percakapan:
${historySummary || 'Tidak ada'}

${this.getNaturalSqlDatasetReference()}

Aturan wajib:
- Hanya boleh membuat satu query SELECT.
- JANGAN gunakan tabel asli database, hanya dataset yang boleh dipakai.
- Gunakan placeholder ? untuk semua nilai dinamis, lalu kirim nilainya di params.
- JANGAN gunakan INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, atau statement selain SELECT.
- JANGAN gunakan tanda ;, komentar SQL, atau multi-statement.
- Batasi hasil maksimal 100 baris.
- Jika user bertanya jumlah/ringkasan, gunakan COUNT/SUM/GROUP BY sesuai kebutuhan.
- Jika user menyebut "pasien ini", "yang sama", atau sejenisnya, gunakan konteks aktif.
- Jika user menyebut "tanggal yang sama", gunakan targetDate dari konteks aktif.
- Jika user menyebut "hari ini", gunakan ${today}.
- Jika tidak bisa dijawab dengan dataset yang tersedia, kembalikan sql = null.

Balas JSON saja dengan skema:
{
  "sql": "SELECT ...",
  "params": ["..."],
  "answer": "penjelasan singkat alami untuk dokter",
  "followUp": ["saran 1", "saran 2"],
  "confidence": 0.0,
  "notes": "catatan singkat"
}
            `.trim()
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content);
      return {
        sql: parsed.sql ? String(parsed.sql).trim() : null,
        params: this.sanitizeNaturalSqlParams(parsed.params),
        answer: parsed.answer ? String(parsed.answer).trim() : '',
        followUp: Array.isArray(parsed.followUp)
          ? parsed.followUp.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
          : [],
        confidence: Number(parsed.confidence || 0),
        notes: parsed.notes ? String(parsed.notes).trim() : ''
      };
    } catch (error) {
      console.error('Failed to parse natural SQL plan:', error);
      return {
        sql: null,
        params: [],
        answer: '',
        followUp: [],
        confidence: 0,
        notes: 'Fallback to null because JSON parsing failed'
      };
    }
  }

  async tryNaturalSqlFallback({ message, username, doctorName, conversationContext, normalizedHistory }) {
    const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(username);
    const naturalPlan = await this.createNaturalSqlPlan({
      message,
      username,
      doctorName,
      conversationContext,
      normalizedHistory
    });

    if (!naturalPlan.sql) {
      return null;
    }

    const validatedSql = this.validateNaturalSqlQuery(naturalPlan.sql, naturalPlan.params);
    const baseQuery = this.buildNaturalSqlBaseQuery(accessibleDoctorCodes);
    const rows = await executeQuery(
      `${baseQuery.sql}\n${validatedSql}`,
      [...baseQuery.params, ...naturalPlan.params]
    );

    const answer = rows.length > 0
      ? (naturalPlan.answer || `Saya menemukan ${rows.length} baris data yang sesuai dengan permintaan Anda.`)
      : 'Saya tidak menemukan data yang sesuai dengan permintaan Anda.';

    return this.buildResponse({
      intent: 'natural_select',
      answer,
      rows,
      sql: validatedSql,
      suggestions: naturalPlan.followUp.length > 0 ? naturalPlan.followUp : this.defaultSuggestions,
      plan: {
        patientName: conversationContext.patientName || null,
        targetDate: conversationContext.targetDate || null,
        startDate: conversationContext.startDate || null,
        endDate: conversationContext.endDate || null,
        careType: conversationContext.careType || null
      },
      previousContext: conversationContext
    });
  }

  async ask({ message, username, doctorName, conversationHistory = [] }) {
    if (!this.openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const normalizedMessage = String(message || '').trim();
    const normalizedUsername = String(username || '').trim();

    if (!normalizedMessage) {
      throw new Error('Pertanyaan tidak boleh kosong');
    }

    if (!normalizedUsername) {
      throw new Error('Username dokter wajib dikirim');
    }

    const normalizedHistory = this.normalizeHistory(conversationHistory);
    const conversationContext = this.extractConversationContext(normalizedHistory);
    const plan = await this.createExecutionPlan({
      message: normalizedMessage,
      username: normalizedUsername,
      doctorName: String(doctorName || '').trim(),
      conversationContext,
      normalizedHistory
    });
    const resolvedPlan = this.resolvePlanWithContext(plan, normalizedMessage, conversationContext);

    if (this.shouldUseNaturalSqlFallback(resolvedPlan)) {
      try {
        const naturalResponse = await this.tryNaturalSqlFallback({
          message: normalizedMessage,
          username: normalizedUsername,
          doctorName: String(doctorName || '').trim(),
          conversationContext,
          normalizedHistory
        });

        if (naturalResponse) {
          return naturalResponse;
        }
      } catch (error) {
        console.error('Natural SQL fallback error:', error);
      }
    }

    switch (resolvedPlan.intent) {
      case 'patient_medical_record_search':
        return this.handlePatientMedicalRecordSearch(resolvedPlan, normalizedUsername, conversationContext);
      case 'patient_search_by_identifier':
        return this.handlePatientSearchByIdentifier(resolvedPlan, normalizedUsername, conversationContext);
      case 'today_patient_list':
        return this.handleTodayPatientList(resolvedPlan, normalizedUsername, conversationContext);
      case 'today_patient_count':
        return this.handleTodayPatientCount(resolvedPlan, normalizedUsername, conversationContext);
      case 'inpatient_operational_summary':
        return this.handleInpatientOperationalSummary(resolvedPlan, normalizedUsername, conversationContext);
      case 'lab_results_by_patient_date':
        return this.handleLabResultsByPatientDate(resolvedPlan, normalizedUsername, conversationContext);
      case 'patient_last_visit_summary':
        return this.handlePatientLastVisitSummary(resolvedPlan, normalizedUsername, conversationContext);
      case 'diagnosis_history_by_patient':
        return this.handleDiagnosisHistoryByPatient(resolvedPlan, normalizedUsername, conversationContext);
      case 'prescription_history_by_patient':
        return this.handlePrescriptionHistoryByPatient(resolvedPlan, normalizedUsername, conversationContext);
      case 'radiology_results_by_patient_date':
        return this.handleRadiologyResultsByPatientDate(resolvedPlan, normalizedUsername, conversationContext);
      case 'inpatient_history_by_patient':
        return this.handleInpatientHistoryByPatient(resolvedPlan, normalizedUsername, conversationContext);
      case 'operation_report_by_patient':
        return this.handleOperationReportByPatient(resolvedPlan, normalizedUsername, conversationContext);
      case 'inpatient_resume_status_list':
        return this.handleInpatientResumeStatusList(resolvedPlan, normalizedUsername, conversationContext);
      case 'inpatient_movement_list':
        return this.handleInpatientMovementList(resolvedPlan, normalizedUsername, conversationContext);
      case 'inpatient_collaboration_list':
        return this.handleInpatientCollaborationList(resolvedPlan, normalizedUsername, conversationContext);
      default:
        return this.buildResponse({
          intent: 'unsupported',
          answer: 'Saat ini saya bisa membantu pencarian rekam medis pasien, pencarian pasien via nomor identitas, daftar pasien dokter, ringkasan operasional rawat inap, status resume rawat inap, pasien pindah kamar, rawat bersama, rawat gabung, kunjungan terakhir, diagnosis, resep, hasil lab, hasil radiologi, rawat inap, laporan operasi, dan jumlah pasien dokter.',
          rows: [],
          sql: null,
          suggestions: this.defaultSuggestions,
          plan: resolvedPlan,
          previousContext: conversationContext
        });
    }
  }

  async createExecutionPlan({ message, username, doctorName, conversationContext, normalizedHistory }) {
    const today = this.getCurrentDateWib();
    const historySummary = normalizedHistory
      .slice(-6)
      .map((entry) => `${entry.role === 'assistant' ? 'AI' : 'Dokter'}: ${entry.message}`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `
Anda adalah perencana query untuk asisten dokter.
Tanggal hari ini di WIB adalah ${today}.
Dokter login: ${doctorName || username} (${username}).

Konteks percakapan aktif:
- patientName: ${conversationContext.patientName || 'null'}
- targetDate: ${conversationContext.targetDate || 'null'}
- startDate: ${conversationContext.startDate || 'null'}
- endDate: ${conversationContext.endDate || 'null'}
- noRawat: ${conversationContext.noRawat || 'null'}
- noRkmMedis: ${conversationContext.noRkmMedis || 'null'}
- identifier: ${conversationContext.identifier || 'null'}
- identifierType: ${conversationContext.identifierType || 'null'}
- careType: ${conversationContext.careType || 'null'}
- inpatientTab: ${conversationContext.inpatientTab || 'null'}
- inpatientStatus: ${conversationContext.inpatientStatus || 'null'}
- resumeStatus: ${conversationContext.resumeStatus || 'null'}
- lastIntent: ${conversationContext.lastIntent || 'null'}

Riwayat percakapan terakhir:
${historySummary || 'Tidak ada'}

Tugas Anda hanya mengubah pertanyaan menjadi JSON dengan intent yang didukung.
JANGAN tulis SQL.
JANGAN tambahkan teks selain JSON.

Intent yang didukung:
1. patient_medical_record_search
2. patient_search_by_identifier
3. today_patient_count
4. lab_results_by_patient_date
5. patient_last_visit_summary
6. diagnosis_history_by_patient
7. prescription_history_by_patient
8. radiology_results_by_patient_date
9. inpatient_history_by_patient
10. operation_report_by_patient
11. today_patient_list
12. inpatient_operational_summary
13. inpatient_resume_status_list
14. inpatient_movement_list
15. inpatient_collaboration_list
16. unsupported

Skema JSON:
{
  "intent": "patient_medical_record_search | patient_search_by_identifier | today_patient_count | today_patient_list | lab_results_by_patient_date | patient_last_visit_summary | diagnosis_history_by_patient | prescription_history_by_patient | radiology_results_by_patient_date | inpatient_history_by_patient | operation_report_by_patient | inpatient_operational_summary | inpatient_resume_status_list | inpatient_movement_list | inpatient_collaboration_list | unsupported",
  "patientName": "string atau null",
  "patientIdentifier": "string atau null",
  "identifierType": "no_rkm_medis | no_ktp | no_rawat | unknown | null",
  "targetDate": "YYYY-MM-DD atau null",
  "startDate": "YYYY-MM-DD atau null",
  "endDate": "YYYY-MM-DD atau null",
  "careType": "all | ralan | ranap",
  "inpatientTab": "rawat-bersama | rawat-gabung | null",
  "inpatientStatus": "all | masih-dirawat | sudah-pulang | pindah-kamar | null",
  "resumeStatus": "all | belum_resume | sudah_resume | null",
  "confidence": 0.0,
  "notes": "penjelasan singkat"
}

Aturan:
- Jika user menanyakan pasien berdasarkan nama, gunakan patient_medical_record_search.
- Jika user menanyakan pasien dengan no rekam medis, NIK, atau no rawat, gunakan patient_search_by_identifier.
- Jika user menanyakan "berapa pasien saya untuk hari ini", gunakan today_patient_count.
- Jika user menanyakan "berapa pasien" dan konteksnya rawat inap, rawat bersama, rawat gabung, belum resume, sudah resume, belum pulang, sudah pulang, atau pindah kamar, gunakan inpatient_operational_summary.
- Jika user menanyakan "tampilkan data pasien saya hari ini", "siapa saja pasien saya hari ini", daftar pasien hari ini, kemarin, rentang tanggal, rawat inap, rawat jalan, atau belum pulang, gunakan today_patient_list.
- Jika user menanyakan kunjungan terakhir pasien, gunakan patient_last_visit_summary.
- Jika user menanyakan diagnosis pasien, ICD pasien, atau riwayat diagnosis, gunakan diagnosis_history_by_patient.
- Jika user menanyakan resep, obat, atau riwayat obat pasien, gunakan prescription_history_by_patient.
- Jika user menanyakan hasil lab pasien, gunakan lab_results_by_patient_date.
- Jika user menanyakan hasil radiologi pasien, gunakan radiology_results_by_patient_date.
- Jika user menanyakan riwayat rawat inap pasien, gunakan inpatient_history_by_patient.
- Jika user menanyakan laporan operasi pasien atau tindakan operasi pasien, gunakan operation_report_by_patient.
- Jika user menanyakan pasien rawat inap yang belum resume, sudah resume, atau status resume rawat inap, gunakan inpatient_resume_status_list.
- Jika user menanyakan pasien rawat inap pindah kamar atau perpindahan kamar pasien ranap, gunakan inpatient_movement_list.
- Jika user menanyakan pasien rawat bersama, pasien raber, pasien konsul rawat inap, atau pasien rawat gabung, gunakan inpatient_collaboration_list.
- Untuk intent operasional rawat inap, patientName atau patientIdentifier boleh diisi jika user menyebut nama pasien, no RM, NIK, atau no rawat sebagai filter.
- Jika user menyebut "pasien ini", "yang sama", "dia", "labnya", "radiologinya", "diagnosisnya", atau sejenisnya, boleh kosongkan patientName agar backend mengambil dari konteks.
- Jika user menyebut "tanggal yang sama", "hari yang sama", atau sejenisnya, boleh kosongkan targetDate agar backend mengambil dari konteks.
- Jika user menyebut "hari ini", ubah menjadi tanggal ${today}.
- Jika user menyebut "kemarin", ubah menjadi tanggal ${this.getRelativeDateWib(-1)}.
- Jika user menyebut "tanggal 10 bulan ini", ubah menjadi tanggal dengan bulan dan tahun dari ${today}.
- Jika user menyebut rentang tanggal seperti "dari tanggal ... sampai tanggal ...", isi startDate dan endDate.
- Jika user menyebut "rawat inap", isi careType = "ranap".
- Jika user menyebut "rawat jalan", isi careType = "ralan".
- Jika user menyebut "rawat bersama", "raber", atau "konsul", isi inpatientTab = "rawat-bersama".
- Jika user menyebut "rawat gabung", isi inpatientTab = "rawat-gabung".
- Jika user menyebut "belum pulang" atau "masih dirawat", isi inpatientStatus = "masih-dirawat".
- Jika user menyebut "sudah pulang", isi inpatientStatus = "sudah-pulang".
- Jika user menyebut "belum resume", isi resumeStatus = "belum_resume".
- Jika user menyebut "sudah resume" atau "sudah ada resume", isi resumeStatus = "sudah_resume".
- Jika tanggal tidak jelas untuk lab atau radiologi, isi targetDate null.
- Jika intent tidak jelas, pilih unsupported.
            `.trim()
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content);
      const normalizedIdentifierType = String(parsed.identifierType || '').trim().toLowerCase();

      return {
        intent: String(parsed.intent || 'unsupported'),
        patientName: parsed.patientName ? String(parsed.patientName).trim() : null,
        patientIdentifier: parsed.patientIdentifier ? String(parsed.patientIdentifier).trim() : null,
        identifierType: ['no_rkm_medis', 'no_ktp', 'no_rawat', 'unknown'].includes(normalizedIdentifierType)
          ? normalizedIdentifierType
          : null,
        targetDate: parsed.targetDate ? String(parsed.targetDate).trim() : null,
        startDate: parsed.startDate ? String(parsed.startDate).trim() : null,
        endDate: parsed.endDate ? String(parsed.endDate).trim() : null,
        careType: ['ralan', 'ranap'].includes(String(parsed.careType || '').toLowerCase())
          ? String(parsed.careType).toLowerCase()
          : 'all',
        inpatientTab: ['rawat-bersama', 'rawat-gabung'].includes(String(parsed.inpatientTab || '').toLowerCase())
          ? String(parsed.inpatientTab).toLowerCase()
          : null,
        inpatientStatus: ['masih-dirawat', 'sudah-pulang', 'pindah-kamar', 'all'].includes(String(parsed.inpatientStatus || '').toLowerCase())
          ? String(parsed.inpatientStatus).toLowerCase()
          : null,
        resumeStatus: ['belum_resume', 'sudah_resume', 'all'].includes(String(parsed.resumeStatus || '').toLowerCase())
          ? String(parsed.resumeStatus).toLowerCase()
          : null,
        confidence: Number(parsed.confidence || 0),
        notes: String(parsed.notes || '').trim()
      };
    } catch (error) {
      console.error('Failed to parse AI assistant plan:', error);
      return {
        intent: 'unsupported',
        patientName: null,
        patientIdentifier: null,
        identifierType: null,
        targetDate: null,
        startDate: null,
        endDate: null,
        careType: 'all',
        inpatientTab: null,
        inpatientStatus: null,
        resumeStatus: null,
        confidence: 0,
        notes: 'Fallback to unsupported because JSON parsing failed'
      };
    }
  }

  buildRowsPayload(rows) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    return {
      rows: normalizedRows,
      columns: normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : []
    };
  }

  buildContextPayload({ rows, plan, previousContext, intent }) {
    const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    return {
      patientName: firstRow?.nm_pasien || plan.patientName || previousContext?.patientName || null,
      targetDate: plan.targetDate || previousContext?.targetDate || null,
      startDate: plan.startDate || previousContext?.startDate || null,
      endDate: plan.endDate || previousContext?.endDate || null,
      noRawat: firstRow?.no_rawat || plan.noRawat || previousContext?.noRawat || null,
      noRkmMedis: firstRow?.no_rkm_medis || previousContext?.noRkmMedis || null,
      identifier: plan.patientIdentifier || previousContext?.identifier || null,
      identifierType: plan.identifierType || previousContext?.identifierType || null,
      careType: plan.careType || previousContext?.careType || null,
      inpatientTab: plan.inpatientTab || previousContext?.inpatientTab || null,
      inpatientStatus: plan.inpatientStatus || previousContext?.inpatientStatus || null,
      resumeStatus: plan.resumeStatus || previousContext?.resumeStatus || null,
      lastIntent: intent || previousContext?.lastIntent || null
    };
  }

  buildResponse({ intent, answer, rows, sql, suggestions, plan, previousContext }) {
    const payload = this.buildRowsPayload(rows);
    const context = this.buildContextPayload({
      rows: payload.rows,
      plan: plan || {},
      previousContext: previousContext || {},
      intent
    });
    return {
      success: true,
      data: {
        intent,
        careType: plan?.careType || null,
        answer,
        rows: payload.rows,
        columns: payload.columns,
        sqlPreview: sql ? this.toSqlPreview(sql) : null,
        suggestions: this.buildContextualSuggestions({
          context,
          intent,
          suggestions: suggestions && suggestions.length > 0 ? suggestions : this.defaultSuggestions
        }),
        context
      }
    };
  }

  buildNeedPatientNameResponse(intent, customAnswer, plan = {}, previousContext = {}) {
    return this.buildResponse({
      intent,
      answer: customAnswer || 'Saya perlu nama pasien untuk melanjutkan pencarian.',
      rows: [],
      sql: null,
      suggestions: [
        'Carikan saya data rekam medis pasien bernama [nama pasien]',
        'Tampilkan diagnosis pasien [nama pasien]',
        'Cari pasien dengan no rekam medis [nomor]'
      ],
      plan,
      previousContext
    });
  }

  buildNeedDateResponse(intent, customAnswer, plan = {}, previousContext = {}) {
    return this.buildResponse({
      intent,
      answer: customAnswer || 'Saya perlu tanggal pemeriksaan untuk melanjutkan pencarian.',
      rows: [],
      sql: null,
      suggestions: [
        'Berikan saya hasil lab untuk pasien [nama pasien] tanggal [tanggal]',
        'Berikan saya hasil radiologi pasien [nama pasien] tanggal [tanggal]'
      ],
      plan,
      previousContext
    });
  }

  async handlePatientMedicalRecordSearch(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien yang ingin dicari. Contoh: carikan saya data rekam medis pasien bernama [nama pasien].',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.no_ktp,
        p.nm_pasien,
        p.jk,
        p.tgl_lahir,
        MAX(rp.tgl_registrasi) AS kunjungan_terakhir,
        COUNT(DISTINCT rp.no_rawat) AS total_kunjungan,
        SUBSTRING_INDEX(
          GROUP_CONCAT(DISTINCT pol.nm_poli ORDER BY rp.tgl_registrasi DESC SEPARATOR ' | '),
          ' | ',
          3
        ) AS poli_terkait
      FROM pasien p
      INNER JOIN reg_periksa rp ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
      WHERE p.nm_pasien LIKE ?
        AND rp.kd_dokter = ?
      GROUP BY p.no_rkm_medis, p.no_ktp, p.nm_pasien, p.jk, p.tgl_lahir
      ORDER BY kunjungan_terakhir DESC
      LIMIT 10
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} data pasien yang cocok untuk nama "${plan.patientName}" pada riwayat pasien Anda.`
      : `Saya tidak menemukan data rekam medis pasien bernama "${plan.patientName}" pada pasien yang terkait dengan akun dokter Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            `Tampilkan kunjungan terakhir pasien ${plan.patientName}`,
            `Tampilkan diagnosis pasien ${plan.patientName}`,
            `Tampilkan riwayat rawat inap pasien ${plan.patientName}`
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  async handlePatientSearchByIdentifier(plan, username, previousContext) {
    if (!plan.patientIdentifier) {
      return this.buildResponse({
        intent: plan.intent,
        answer: 'Saya perlu nomor pencarian pasien, misalnya no rekam medis, NIK, atau no rawat.',
        rows: [],
        sql: null,
        suggestions: [
          'Cari pasien dengan no rekam medis [nomor]',
          'Cari pasien dengan NIK [nomor]',
          'Cari pasien dengan no rawat [nomor]'
        ],
        plan,
        previousContext
      });
    }

    let identifierColumn = 'p.no_rkm_medis';
    if (plan.identifierType === 'no_ktp') {
      identifierColumn = 'p.no_ktp';
    } else if (plan.identifierType === 'no_rawat') {
      identifierColumn = 'rp.no_rawat';
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.no_ktp,
        p.nm_pasien,
        p.jk,
        p.tgl_lahir,
        rp.no_rawat,
        rp.tgl_registrasi,
        pol.nm_poli
      FROM reg_periksa rp
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
      WHERE ${identifierColumn} = ?
        AND rp.kd_dokter = ?
      ORDER BY rp.tgl_registrasi DESC, rp.no_rawat DESC
      LIMIT 20
    `;

    const rows = await executeQuery(sql, [plan.patientIdentifier, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} data pasien untuk nomor "${plan.patientIdentifier}".`
      : `Saya tidak menemukan data pasien untuk nomor "${plan.patientIdentifier}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan kunjungan terakhir pasien ini',
            'Tampilkan diagnosis pasien ini',
            'Tampilkan resep pasien ini'
          ]
        : ['Periksa kembali nomor yang digunakan'],
      plan,
      previousContext
    });
  }

  async handleTodayPatientCount(plan, username, previousContext) {
    const shouldDefaultToday = !(plan.careType === 'ranap' && plan.inpatientStatus === 'masih-dirawat');
    const params = [username];
    const dateClause = this.buildDateFilterClause(plan, params, 'rp.tgl_registrasi', shouldDefaultToday);
    const careTypeClause = plan.careType === 'ralan' || plan.careType === 'ranap'
      ? 'AND rp.status_lanjut = ?'
      : '';
    const inpatientStatusClause = this.buildInpatientStatusClause(plan);
    const sql = `
      SELECT
        COUNT(DISTINCT rp.no_rawat) AS total_pasien,
        COUNT(DISTINCT CASE WHEN rp.status_lanjut = 'Ralan' THEN rp.no_rawat END) AS rawat_jalan,
        COUNT(DISTINCT CASE WHEN rp.status_lanjut = 'Ranap' THEN rp.no_rawat END) AS rawat_inap
      FROM reg_periksa rp
      WHERE rp.kd_dokter = ?
        ${dateClause}
        ${careTypeClause}
        ${inpatientStatusClause}
    `;
    if (careTypeClause) {
      params.push(plan.careType === 'ralan' ? 'Ralan' : 'Ranap');
    }

    const rows = await executeQuery(sql, params);
    const summary = rows[0] || { total_pasien: 0, rawat_jalan: 0, rawat_inap: 0 };
    const periodLabel = this.formatPatientListPeriod(plan);

    return this.buildResponse({
      intent: plan.intent,
      answer: `Jumlah pasien Anda pada ${periodLabel} adalah ${summary.total_pasien || 0}. Terdiri dari ${summary.rawat_jalan || 0} rawat jalan dan ${summary.rawat_inap || 0} rawat inap.`,
      rows: [summary],
      sql,
      suggestions: [
        'Tampilkan data pasien saya hari ini',
        'Tampilkan data pasien saya kemarin',
        'Berapa pasien rawat jalan saya untuk hari ini?',
        'Berapa pasien rawat inap saya untuk hari ini?',
        'Tampilkan data pasien saya rawat inap belum pulang',
        'Tampilkan kunjungan terakhir pasien [nama pasien]'
      ],
      plan: { ...plan, targetDate: plan.targetDate || (shouldDefaultToday ? this.getCurrentDateWib() : null) },
      previousContext
    });
  }

  async handleTodayPatientList(plan, username, previousContext) {
    const shouldDefaultToday = !(plan.careType === 'ranap' && plan.inpatientStatus === 'masih-dirawat');
    const params = [username];
    const dateClause = this.buildDateFilterClause(plan, params, 'rp.tgl_registrasi', shouldDefaultToday);
    const careTypeClause = plan.careType === 'ralan' || plan.careType === 'ranap'
      ? 'AND rp.status_lanjut = ?'
      : '';
    const inpatientStatusClause = this.buildInpatientStatusClause(plan);
    const sql = `
      SELECT
        rp.no_rawat,
        rp.tgl_registrasi,
        rp.no_reg,
        rp.status_lanjut,
        rp.stts,
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk,
        pol.nm_poli
      FROM reg_periksa rp
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
      WHERE rp.kd_dokter = ?
        ${dateClause}
        ${careTypeClause}
        ${inpatientStatusClause}
      ORDER BY rp.no_reg ASC, p.nm_pasien ASC
      LIMIT 200
    `;
    if (careTypeClause) {
      params.push(plan.careType === 'ralan' ? 'Ralan' : 'Ranap');
    }

    const rows = await executeQuery(sql, params);
    const periodLabel = this.formatPatientListPeriod(plan);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} pasien Anda pada ${periodLabel}.`
      : `Saya tidak menemukan pasien Anda pada ${periodLabel}.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: [
        'Berapa pasien saya untuk hari ini?',
        'Tampilkan data pasien saya kemarin',
        'Berapa pasien rawat jalan saya untuk hari ini?',
        'Berapa pasien rawat inap saya untuk hari ini?',
        'Tampilkan data pasien saya rawat inap belum pulang',
        'Tampilkan data pasien saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
      ],
      plan: { ...plan, targetDate: plan.targetDate || (shouldDefaultToday ? this.getCurrentDateWib() : null) },
      previousContext
    });
  }

  async handleInpatientOperationalSummary(plan, username, previousContext) {
    const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(username);
    const doctorCodes = accessibleDoctorCodes.length > 0 ? accessibleDoctorCodes : [username];
    const doctorPlaceholders = this.buildInClausePlaceholders(doctorCodes);
    const normalizedPlan = {
      ...plan,
      careType: 'ranap'
    };
    const hasSpecificFilter = Boolean(
      normalizedPlan.inpatientTab ||
      normalizedPlan.inpatientStatus ||
      normalizedPlan.resumeStatus ||
      normalizedPlan.patientName ||
      normalizedPlan.patientIdentifier
    );

    const countGeneralInpatient = async (overrides = {}) => {
      const effectivePlan = { ...normalizedPlan, ...overrides, careType: 'ranap' };
      const statusPulangValue = String(effectivePlan.inpatientStatus || '').trim();
      const dateColumn = statusPulangValue === 'sudah-pulang'
        ? this.getDischargeDateFilterColumn(doctorCodes)
        : 'ki.tgl_masuk';
      const params = [...doctorCodes];
      const dateClause = this.buildDateFilterClause(effectivePlan, params, dateColumn, false);
      const inpatientStatusClause = this.buildKamarInapStatusClause(effectivePlan);
      const resumeStatusClause = this.buildResumeStatusClause(effectivePlan);
      const patientSearchClause = this.buildPatientSearchClause(effectivePlan, params, {
        patientAlias: 'p',
        noRawatColumn: 'ki.no_rawat'
      });
      const sql = `
        SELECT COUNT(DISTINCT ki.no_rawat) AS total_pasien
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        WHERE EXISTS (
          SELECT 1
          FROM dpjp_ranap dr_user
          WHERE dr_user.no_rawat = ki.no_rawat
            AND dr_user.kd_dokter IN (${doctorPlaceholders})
            AND COALESCE(dr_user.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
        )
          ${dateClause}
          ${inpatientStatusClause}
          ${resumeStatusClause}
          ${patientSearchClause}
      `;
      const rows = await executeQuery(sql, params);
      return Number(rows?.[0]?.total_pasien || 0);
    };

    const countMovement = async (overrides = {}) => {
      const effectivePlan = {
        ...normalizedPlan,
        ...overrides,
        careType: 'ranap',
        inpatientStatus: 'pindah-kamar'
      };
      const params = [...doctorCodes];
      const dateClause = this.buildDateFilterClause(effectivePlan, params, 'ki.tgl_masuk', false);
      const resumeStatusClause = this.buildResumeStatusClause(effectivePlan);
      const patientSearchClause = this.buildPatientSearchClause(effectivePlan, params, {
        patientAlias: 'p',
        noRawatColumn: 'ki.no_rawat'
      });
      const sql = `
        SELECT COUNT(DISTINCT ki.no_rawat) AS total_pasien
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        WHERE EXISTS (
          SELECT 1
          FROM dpjp_ranap dr_user
          WHERE dr_user.no_rawat = ki.no_rawat
            AND dr_user.kd_dokter IN (${doctorPlaceholders})
        )
          AND COALESCE(ki.stts_pulang, '') = 'Pindah Kamar'
          ${dateClause}
          ${resumeStatusClause}
          ${patientSearchClause}
      `;
      const rows = await executeQuery(sql, params);
      return Number(rows?.[0]?.total_pasien || 0);
    };

    const countCollaboration = async (tab, overrides = {}) => {
      const effectivePlan = {
        ...normalizedPlan,
        ...overrides,
        careType: 'ranap',
        inpatientTab: tab
      };
      const statusPulangValue = String(effectivePlan.inpatientStatus || '').trim();
      const dateColumn = statusPulangValue === 'sudah-pulang'
        ? this.getDischargeDateFilterColumn(doctorCodes)
        : 'ki.tgl_masuk';
      const params = [...doctorCodes];
      const dateClause = this.buildDateFilterClause(effectivePlan, params, dateColumn, false);
      const resumeStatusClause = this.buildResumeStatusClause(effectivePlan);
      const patientSearchClause = this.buildPatientSearchClause(effectivePlan, params, {
        patientAlias: 'p',
        noRawatColumn: tab === 'rawat-gabung' ? 'rp.no_rawat' : 'ki.no_rawat'
      });
      const statusClause = this.buildKamarInapStatusClause({ ...effectivePlan, careType: 'ranap' });

      const sql = tab === 'rawat-gabung'
        ? `
          SELECT COUNT(DISTINCT rp.no_rawat) AS total_pasien
          FROM ranap_gabung rg
          LEFT JOIN reg_periksa rp ON rg.no_rawat2 = rp.no_rawat
          LEFT JOIN kamar_inap ki ON rg.no_rawat = ki.no_rawat
          LEFT JOIN resume_pasien_ranap rpr ON rp.no_rawat = rpr.no_rawat
          LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
          LEFT JOIN dpjp_ranap dr ON rp.no_rawat = dr.no_rawat
          WHERE dr.kd_dokter IN (${doctorPlaceholders})
            AND COALESCE(dr.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
            ${dateClause}
            ${statusClause}
            ${resumeStatusClause}
            ${patientSearchClause}
        `
        : `
          SELECT COUNT(DISTINCT ki.no_rawat) AS total_pasien
          FROM kamar_inap ki
          LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
          LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
          LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
          WHERE EXISTS (
            SELECT 1
            FROM dpjp_ranap dr_raber
            WHERE dr_raber.no_rawat = ki.no_rawat
              AND dr_raber.kd_dokter IN (${doctorPlaceholders})
              AND dr_raber.jenis_dpjp IN ('Raber', 'Konsul')
          )
            ${dateClause}
            ${statusClause}
            ${resumeStatusClause}
            ${patientSearchClause}
        `;

      const rows = await executeQuery(sql, params);
      return Number(rows?.[0]?.total_pasien || 0);
    };

    if (!hasSpecificFilter) {
      const [
        totalRanap,
        masihDirawat,
        sudahPulang,
        belumResume,
        sudahResume,
        pindahKamar,
        rawatBersama,
        rawatGabung
      ] = await Promise.all([
        countGeneralInpatient(),
        countGeneralInpatient({ inpatientStatus: 'masih-dirawat' }),
        countGeneralInpatient({ inpatientStatus: 'sudah-pulang' }),
        countGeneralInpatient({ resumeStatus: 'belum_resume' }),
        countGeneralInpatient({ resumeStatus: 'sudah_resume' }),
        countMovement(),
        countCollaboration('rawat-bersama'),
        countCollaboration('rawat-gabung')
      ]);

      const periodLabel = this.formatPatientListPeriod(normalizedPlan);
      return this.buildResponse({
        intent: 'inpatient_operational_summary',
        answer: `Ringkasan operasional rawat inap Anda pada ${periodLabel} sudah saya siapkan.`,
        rows: [
          {
            total_rawat_inap: totalRanap,
            masih_dirawat: masihDirawat,
            sudah_pulang: sudahPulang,
            belum_resume: belumResume,
            sudah_resume: sudahResume,
            pindah_kamar: pindahKamar,
            rawat_bersama: rawatBersama,
            rawat_gabung: rawatGabung
          }
        ],
        sql: null,
        suggestions: [
          'Tampilkan data pasien rawat inap saya yang belum resume',
          'Tampilkan data pasien rawat inap saya pindah kamar',
          'Tampilkan data pasien rawat bersama saya',
          'Tampilkan data pasien rawat gabung saya'
        ],
        plan: normalizedPlan,
        previousContext
      });
    }

    let totalPasien = 0;
    let label = 'rawat inap';

    if (normalizedPlan.inpatientTab === 'rawat-bersama') {
      totalPasien = await countCollaboration('rawat-bersama');
      label = 'rawat bersama';
    } else if (normalizedPlan.inpatientTab === 'rawat-gabung') {
      totalPasien = await countCollaboration('rawat-gabung');
      label = 'rawat gabung';
    } else if (normalizedPlan.inpatientStatus === 'pindah-kamar') {
      totalPasien = await countMovement();
      label = 'rawat inap pindah kamar';
    } else {
      totalPasien = await countGeneralInpatient();
      if (normalizedPlan.resumeStatus === 'belum_resume') {
        label = 'rawat inap belum resume';
      } else if (normalizedPlan.resumeStatus === 'sudah_resume') {
        label = 'rawat inap sudah resume';
      } else if (normalizedPlan.inpatientStatus === 'masih-dirawat') {
        label = 'rawat inap belum pulang';
      } else if (normalizedPlan.inpatientStatus === 'sudah-pulang') {
        label = 'rawat inap sudah pulang';
      }
    }

    const periodLabel = this.formatPatientListPeriod(normalizedPlan);
    return this.buildResponse({
      intent: 'inpatient_operational_summary',
      answer: `Jumlah pasien ${label} Anda pada ${periodLabel} adalah ${totalPasien}.`,
      rows: [
        {
          kategori: label,
          total_pasien: totalPasien,
          periode: periodLabel
        }
      ],
      sql: null,
      suggestions: [
        'Tampilkan data pasien rawat inap saya yang belum resume',
        'Tampilkan data pasien rawat inap saya pindah kamar',
        'Tampilkan data pasien rawat bersama saya',
        'Tampilkan data pasien rawat gabung saya'
      ],
      plan: normalizedPlan,
      previousContext
    });
  }

  async handleInpatientResumeStatusList(plan, username, previousContext) {
    const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(username);
    const doctorCodes = accessibleDoctorCodes.length > 0 ? accessibleDoctorCodes : [username];
    const doctorPlaceholders = this.buildInClausePlaceholders(doctorCodes);
    const statusPulangValue = String(plan.inpatientStatus || '').trim();
    const dateColumn = statusPulangValue === 'sudah-pulang'
      ? this.getDischargeDateFilterColumn(doctorCodes)
      : 'ki.tgl_masuk';
    const params = [...doctorCodes];
    const dateClause = this.buildDateFilterClause(plan, params, dateColumn, false);
    const inpatientStatusClause = this.buildKamarInapStatusClause({ ...plan, careType: 'ranap' });
    const resumeStatusClause = this.buildResumeStatusClause(plan);
    const patientSearchClause = this.buildPatientSearchClause(plan, params, {
      patientAlias: 'p',
      noRawatColumn: 'ki.no_rawat'
    });
    const sql = `
      SELECT
        ki.no_rawat,
        p.no_rkm_medis,
        p.nm_pasien,
        MIN(DATE(ki.tgl_masuk)) AS tgl_masuk,
        NULLIF(
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ),
          ''
        ) AS tgl_keluar,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) AS stts_pulang,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(b.nm_bangsal, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) AS nm_bangsal,
        CASE
          WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
          ELSE 'belum_resume'
        END AS status_resume
      FROM kamar_inap ki
      LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
      LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE EXISTS (
        SELECT 1
        FROM dpjp_ranap dr_user
        WHERE dr_user.no_rawat = ki.no_rawat
          AND dr_user.kd_dokter IN (${doctorPlaceholders})
          AND COALESCE(dr_user.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
      )
        ${dateClause}
        ${inpatientStatusClause}
        ${resumeStatusClause}
        ${patientSearchClause}
      GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, rpr.no_rawat
      ORDER BY MIN(ki.tgl_masuk) DESC
      LIMIT 200
    `;

    const rows = await executeQuery(sql, params);
    const periodLabel = this.formatPatientListPeriod({ ...plan, careType: 'ranap' });
    const resumeLabel = plan.resumeStatus === 'belum_resume'
      ? 'yang belum resume'
      : plan.resumeStatus === 'sudah_resume'
      ? 'yang sudah resume'
      : 'berdasarkan status resume';
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} pasien rawat inap Anda ${resumeLabel} pada ${periodLabel}.`
      : `Saya tidak menemukan pasien rawat inap Anda ${resumeLabel} pada ${periodLabel}.`;

    return this.buildResponse({
      intent: 'inpatient_resume_status_list',
      answer,
      rows,
      sql,
      suggestions: [
        'Tampilkan data pasien rawat inap saya yang belum resume',
        'Tampilkan data pasien rawat inap saya yang sudah resume',
        'Tampilkan data pasien rawat inap saya yang belum resume dan belum pulang',
        'Tampilkan data pasien rawat inap saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
      ],
      plan: { ...plan, careType: 'ranap' },
      previousContext
    });
  }

  async handleInpatientMovementList(plan, username, previousContext) {
    const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(username);
    const doctorCodes = accessibleDoctorCodes.length > 0 ? accessibleDoctorCodes : [username];
    const doctorPlaceholders = this.buildInClausePlaceholders(doctorCodes);
    const params = [...doctorCodes];
    const normalizedPlan = {
      ...plan,
      careType: 'ranap',
      inpatientStatus: 'pindah-kamar'
    };
    const dateClause = this.buildDateFilterClause(normalizedPlan, params, 'ki.tgl_masuk', false);
    const resumeStatusClause = this.buildResumeStatusClause(plan);
    const patientSearchClause = this.buildPatientSearchClause(plan, params, {
      patientAlias: 'p',
      noRawatColumn: 'ki.no_rawat'
    });
    const sql = `
      SELECT
        ki.no_rawat,
        p.no_rkm_medis,
        p.nm_pasien,
        DATE(ki.tgl_masuk) AS tgl_masuk,
        DATE(ki.tgl_keluar) AS tgl_keluar,
        ki.stts_pulang,
        k.kd_kamar,
        b.nm_bangsal,
        rp.tgl_registrasi,
        rp.status_lanjut,
        CASE
          WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
          ELSE 'belum_resume'
        END AS status_resume
      FROM kamar_inap ki
      LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
      LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE EXISTS (
        SELECT 1
        FROM dpjp_ranap dr_user
        WHERE dr_user.no_rawat = ki.no_rawat
          AND dr_user.kd_dokter IN (${doctorPlaceholders})
      )
        AND COALESCE(ki.stts_pulang, '') = 'Pindah Kamar'
        ${dateClause}
        ${resumeStatusClause}
        ${patientSearchClause}
      ORDER BY ki.tgl_masuk DESC, p.nm_pasien ASC
      LIMIT 200
    `;

    const rows = await executeQuery(sql, params);
    const periodLabel = this.formatPatientListPeriod(normalizedPlan);
    const resumeLabel = plan.resumeStatus === 'belum_resume'
      ? 'yang belum resume'
      : plan.resumeStatus === 'sudah_resume'
      ? 'yang sudah resume'
      : '';
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} data perpindahan kamar pasien rawat inap Anda ${resumeLabel ? `${resumeLabel} ` : ''}pada ${periodLabel}.`
      : `Saya tidak menemukan data perpindahan kamar pasien rawat inap Anda ${resumeLabel ? `${resumeLabel} ` : ''}pada ${periodLabel}.`;

    return this.buildResponse({
      intent: 'inpatient_movement_list',
      answer,
      rows,
      sql,
      suggestions: [
        'Tampilkan data pasien rawat inap saya pindah kamar',
        'Tampilkan data pasien rawat inap saya pindah kamar yang belum resume',
        'Tampilkan data pasien rawat inap saya pindah kamar dari tanggal [tanggal awal] sampai [tanggal akhir]',
        'Tampilkan data pasien rawat inap saya yang belum resume'
      ],
      plan: normalizedPlan,
      previousContext
    });
  }

  async handleInpatientCollaborationList(plan, username, previousContext) {
    const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(username);
    const doctorCodes = accessibleDoctorCodes.length > 0 ? accessibleDoctorCodes : [username];
    const doctorPlaceholders = this.buildInClausePlaceholders(doctorCodes);
    const normalizedTab = String(plan.inpatientTab || '').trim();

    if (!['rawat-bersama', 'rawat-gabung'].includes(normalizedTab)) {
      return this.buildResponse({
        intent: 'inpatient_collaboration_list',
        answer: 'Saya perlu jenis daftar rawat inap yang ingin ditampilkan, misalnya rawat bersama atau rawat gabung.',
        rows: [],
        sql: null,
        suggestions: [
          'Tampilkan data pasien rawat bersama saya',
          'Tampilkan data pasien rawat gabung saya'
        ],
        plan,
        previousContext
      });
    }

    const params = [...doctorCodes];
    const statusPulangValue = String(plan.inpatientStatus || '').trim();
    const dateColumn = statusPulangValue === 'sudah-pulang'
      ? this.getDischargeDateFilterColumn(doctorCodes)
      : 'ki.tgl_masuk';
    const dateClause = this.buildDateFilterClause(plan, params, dateColumn, false);
    const resumeStatusClause = this.buildResumeStatusClause(plan);
    const patientSearchClause = this.buildPatientSearchClause(plan, params, {
      patientAlias: 'p',
      noRawatColumn: normalizedTab === 'rawat-gabung' ? 'rp.no_rawat' : 'ki.no_rawat'
    });

    const sql = normalizedTab === 'rawat-gabung'
      ? `
        SELECT
          rp.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          MIN(DATE(ki.tgl_masuk)) AS tgl_masuk,
          NULLIF(
            SUBSTRING_INDEX(
              GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
              '||',
              1
            ),
            ''
          ) AS tgl_keluar,
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ) AS stts_pulang,
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(b.nm_bangsal, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ) AS nm_bangsal,
          CASE
            WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
            ELSE 'belum_resume'
          END AS status_resume
        FROM ranap_gabung rg
        LEFT JOIN reg_periksa rp ON rg.no_rawat2 = rp.no_rawat
        LEFT JOIN kamar_inap ki ON rg.no_rawat = ki.no_rawat
        LEFT JOIN resume_pasien_ranap rpr ON rp.no_rawat = rpr.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON rp.no_rawat = dr.no_rawat
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        WHERE dr.kd_dokter IN (${doctorPlaceholders})
          AND COALESCE(dr.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
          ${dateClause}
          ${this.buildKamarInapStatusClause({ ...plan, careType: 'ranap' })}
          ${resumeStatusClause}
          ${patientSearchClause}
        GROUP BY rp.no_rawat, p.no_rkm_medis, p.nm_pasien, rpr.no_rawat
        ORDER BY rp.tgl_registrasi ASC, rp.jam_reg ASC
        LIMIT 200
      `
      : `
        SELECT
          ki.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          MIN(DATE(ki.tgl_masuk)) AS tgl_masuk,
          NULLIF(
            SUBSTRING_INDEX(
              GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
              '||',
              1
            ),
            ''
          ) AS tgl_keluar,
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ) AS stts_pulang,
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(b.nm_bangsal, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ) AS nm_bangsal,
          CASE
            WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
            ELSE 'belum_resume'
          END AS status_resume
        FROM kamar_inap ki
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        WHERE EXISTS (
          SELECT 1
          FROM dpjp_ranap dr_raber
          WHERE dr_raber.no_rawat = ki.no_rawat
            AND dr_raber.kd_dokter IN (${doctorPlaceholders})
            AND dr_raber.jenis_dpjp IN ('Raber', 'Konsul')
        )
          ${dateClause}
          ${this.buildKamarInapStatusClause({ ...plan, careType: 'ranap' })}
          ${resumeStatusClause}
          ${patientSearchClause}
        GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, rpr.no_rawat
        ORDER BY MIN(ki.tgl_masuk) ASC
        LIMIT 200
      `;

    const rows = await executeQuery(sql, params);
    const tabLabel = normalizedTab === 'rawat-gabung' ? 'rawat gabung' : 'rawat bersama';
    const periodLabel = this.formatPatientListPeriod({ ...plan, careType: 'ranap' });
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} pasien ${tabLabel} Anda pada ${periodLabel}.`
      : `Saya tidak menemukan pasien ${tabLabel} Anda pada ${periodLabel}.`;

    return this.buildResponse({
      intent: 'inpatient_collaboration_list',
      answer,
      rows,
      sql,
      suggestions: normalizedTab === 'rawat-gabung'
        ? [
            'Tampilkan data pasien rawat gabung saya',
            'Tampilkan data pasien rawat gabung saya yang belum resume',
            'Tampilkan data pasien rawat gabung saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
          ]
        : [
            'Tampilkan data pasien rawat bersama saya',
            'Tampilkan data pasien rawat bersama saya yang sudah pulang',
            'Tampilkan data pasien rawat bersama saya dari tanggal [tanggal awal] sampai [tanggal akhir]'
          ],
      plan: { ...plan, careType: 'ranap', inpatientTab: normalizedTab },
      previousContext
    });
  }

  async handleLabResultsByPatientDate(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari hasil laboratorium.',
        plan,
        previousContext
      );
    }

    if (!plan.targetDate) {
      return this.buildNeedDateResponse(
        plan.intent,
        'Saya perlu tanggal pemeriksaan laboratorium. Contoh: tanggal [tanggal].',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        pl.no_rawat,
        DATE(pl.tgl_periksa) AS tgl_periksa,
        pl.jam,
        jp.nm_perawatan,
        COALESCE(tl.Pemeriksaan, '') AS pemeriksaan,
        COALESCE(dpl.nilai, '') AS hasil,
        COALESCE(dpl.nilai_rujukan, '') AS nilai_rujukan,
        COALESCE(dpl.keterangan, '') AS keterangan
      FROM periksa_lab pl
      INNER JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN jns_perawatan_lab jp ON jp.kd_jenis_prw = pl.kd_jenis_prw
      LEFT JOIN detail_periksa_lab dpl
        ON dpl.no_rawat = pl.no_rawat
        AND dpl.kd_jenis_prw = pl.kd_jenis_prw
        AND dpl.tgl_periksa = pl.tgl_periksa
        AND dpl.jam = pl.jam
      LEFT JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
      WHERE p.nm_pasien LIKE ?
        AND DATE(pl.tgl_periksa) = ?
        AND rp.kd_dokter = ?
      ORDER BY pl.tgl_periksa DESC, pl.jam DESC, jp.nm_perawatan, tl.Pemeriksaan
      LIMIT 100
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, plan.targetDate, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} baris hasil laboratorium untuk pasien "${plan.patientName}" pada tanggal ${plan.targetDate}.`
      : `Saya tidak menemukan hasil laboratorium untuk pasien "${plan.patientName}" pada tanggal ${plan.targetDate} di data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan diagnosis pasien ini',
            'Berikan saya hasil radiologi pasien ini tanggal yang sama'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap atau tanggal yang berbeda'],
      plan,
      previousContext
    });
  }

  async handlePatientLastVisitSummary(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari kunjungan terakhir.',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        rp.no_rawat,
        rp.tgl_registrasi,
        rp.status_lanjut,
        rp.stts,
        pol.nm_poli,
        d.nm_dokter,
        COALESCE(
          SUBSTRING_INDEX(
            GROUP_CONCAT(DISTINCT py.nm_penyakit ORDER BY dp.prioritas ASC SEPARATOR ' | '),
            ' | ',
            5
          ),
          ''
        ) AS diagnosis
      FROM reg_periksa rp
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
      LEFT JOIN dokter d ON d.kd_dokter = rp.kd_dokter
      LEFT JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat
      LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
      WHERE p.nm_pasien LIKE ?
        AND rp.kd_dokter = ?
      GROUP BY p.no_rkm_medis, p.nm_pasien, rp.no_rawat, rp.tgl_registrasi, rp.status_lanjut, rp.stts, pol.nm_poli, d.nm_dokter
      ORDER BY rp.tgl_registrasi DESC, rp.no_rawat DESC
      LIMIT 1
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan kunjungan terakhir pasien "${plan.patientName}".`
      : `Saya tidak menemukan kunjungan terakhir pasien "${plan.patientName}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan diagnosis pasien ini',
            'Tampilkan resep pasien ini',
            'Tampilkan laporan operasi pasien ini'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  async handleDiagnosisHistoryByPatient(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari diagnosis.',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        rp.no_rawat,
        rp.tgl_registrasi,
        pol.nm_poli,
        dp.kd_penyakit,
        py.nm_penyakit,
        dp.prioritas,
        dp.status
      FROM diagnosa_pasien dp
      INNER JOIN reg_periksa rp ON rp.no_rawat = dp.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN poliklinik pol ON pol.kd_poli = rp.kd_poli
      LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
      WHERE p.nm_pasien LIKE ?
        AND rp.kd_dokter = ?
      ORDER BY rp.tgl_registrasi DESC, dp.prioritas ASC, dp.kd_penyakit ASC
      LIMIT 50
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} baris diagnosis untuk pasien "${plan.patientName}".`
      : `Saya tidak menemukan diagnosis untuk pasien "${plan.patientName}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan resep pasien ini',
            'Berikan saya hasil lab pasien ini tanggal [tanggal]'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  async handlePrescriptionHistoryByPatient(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari riwayat resep.',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        ro.no_resep,
        ro.no_rawat,
        CASE
          WHEN ro.tgl_perawatan IS NULL OR ro.tgl_perawatan = '0000-00-00' THEN ro.tgl_peresepan
          ELSE ro.tgl_perawatan
        END AS tanggal_resep,
        CASE
          WHEN ro.jam IS NULL OR ro.jam = '00:00:00' THEN ro.jam_peresepan
          ELSE ro.jam
        END AS jam_resep,
        db.nama_brng,
        dpo.jml,
        COALESCE(ap.aturan, '') AS aturan_pakai
      FROM resep_obat ro
      INNER JOIN reg_periksa rp ON rp.no_rawat = ro.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN detail_pemberian_obat dpo
        ON dpo.tgl_perawatan = ro.tgl_perawatan
        AND dpo.jam = ro.jam
      LEFT JOIN databarang db ON db.kode_brng = dpo.kode_brng
      LEFT JOIN aturan_pakai ap
        ON ap.no_rawat = ro.no_rawat
        AND ap.kode_brng = dpo.kode_brng
        AND ap.tgl_perawatan = ro.tgl_perawatan
        AND ap.jam = ro.jam
      WHERE p.nm_pasien LIKE ?
        AND ro.kd_dokter = ?
      ORDER BY tanggal_resep DESC, jam_resep DESC, db.nama_brng ASC
      LIMIT 100
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} baris riwayat resep untuk pasien "${plan.patientName}".`
      : `Saya tidak menemukan riwayat resep untuk pasien "${plan.patientName}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan diagnosis pasien ini',
            'Tampilkan kunjungan terakhir pasien ini'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  async handleRadiologyResultsByPatientDate(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari hasil radiologi.',
        plan,
        previousContext
      );
    }

    if (!plan.targetDate) {
      return this.buildNeedDateResponse(
        plan.intent,
        'Saya perlu tanggal pemeriksaan radiologi. Contoh: tanggal [tanggal].',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        pr.no_rawat,
        DATE(pr.tgl_periksa) AS tgl_periksa,
        pr.jam,
        jpr.nm_perawatan,
        COALESCE(hr.hasil, '') AS hasil
      FROM periksa_radiologi pr
      INNER JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = pr.kd_jenis_prw
      LEFT JOIN hasil_radiologi hr ON hr.no_rawat = pr.no_rawat AND hr.tgl_periksa = pr.tgl_periksa
      WHERE p.nm_pasien LIKE ?
        AND DATE(pr.tgl_periksa) = ?
        AND rp.kd_dokter = ?
      ORDER BY pr.tgl_periksa DESC, pr.jam DESC, jpr.nm_perawatan ASC
      LIMIT 100
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, plan.targetDate, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} baris hasil radiologi untuk pasien "${plan.patientName}" pada tanggal ${plan.targetDate}.`
      : `Saya tidak menemukan hasil radiologi untuk pasien "${plan.patientName}" pada tanggal ${plan.targetDate} di data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Berikan saya hasil lab pasien ini tanggal yang sama',
            'Tampilkan laporan operasi pasien ini'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap atau tanggal yang berbeda'],
      plan,
      previousContext
    });
  }

  async handleInpatientHistoryByPatient(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari riwayat rawat inap.',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT DISTINCT
        p.no_rkm_medis,
        p.nm_pasien,
        ki.no_rawat,
        ki.tgl_masuk,
        ki.jam_masuk,
        ki.tgl_keluar,
        ki.jam_keluar,
        b.nm_bangsal,
        ki.kd_kamar
      FROM kamar_inap ki
      INNER JOIN reg_periksa rp ON rp.no_rawat = ki.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      INNER JOIN dpjp_ranap dr ON dr.no_rawat = ki.no_rawat
      LEFT JOIN kamar k ON k.kd_kamar = ki.kd_kamar
      LEFT JOIN bangsal b ON b.kd_bangsal = k.kd_bangsal
      WHERE p.nm_pasien LIKE ?
        AND dr.kd_dokter = ?
      ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC
      LIMIT 20
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} data riwayat rawat inap untuk pasien "${plan.patientName}".`
      : `Saya tidak menemukan riwayat rawat inap untuk pasien "${plan.patientName}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan kunjungan terakhir pasien ini',
            'Tampilkan laporan operasi pasien ini'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  async handleOperationReportByPatient(plan, username, previousContext) {
    if (!plan.patientName) {
      return this.buildNeedPatientNameResponse(
        plan.intent,
        'Saya perlu nama pasien untuk mencari laporan operasi.',
        plan,
        previousContext
      );
    }

    const sql = `
      SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        lo.no_rawat,
        lo.tanggal_op,
        lo.nm_op,
        lo.hasil_op,
        lo.pre_op,
        lo.post_op
      FROM mlite_lap_op lo
      INNER JOIN reg_periksa rp ON rp.no_rawat = lo.no_rawat
      INNER JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
      WHERE p.nm_pasien LIKE ?
        AND lo.kd_dokter = ?
        AND lo.deleted_at IS NULL
      ORDER BY lo.tanggal_op DESC, lo.id DESC
      LIMIT 20
    `;

    const rows = await executeQuery(sql, [`%${plan.patientName}%`, username]);
    const answer = rows.length > 0
      ? `Saya menemukan ${rows.length} laporan operasi untuk pasien "${plan.patientName}".`
      : `Saya tidak menemukan laporan operasi untuk pasien "${plan.patientName}" pada data pasien Anda.`;

    return this.buildResponse({
      intent: plan.intent,
      answer,
      rows,
      sql,
      suggestions: rows.length > 0
        ? [
            'Tampilkan riwayat rawat inap pasien ini',
            'Tampilkan kunjungan terakhir pasien ini'
          ]
        : ['Coba gunakan nama pasien yang lebih lengkap'],
      plan,
      previousContext
    });
  }

  toSqlPreview(sql) {
    return String(sql || '').replace(/\s+/g, ' ').trim();
  }
}

export default new DoctorAiAssistantService();
