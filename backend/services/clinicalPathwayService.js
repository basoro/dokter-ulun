import db from '../config/database.js';

const CATEGORY_ORDER = ['Assessment', 'Monitoring', 'Tindakan', 'Obat', 'Laboratorium', 'Radiologi', 'Nutrisi', 'Edukasi', 'Outcome'];

class ClinicalPathwayService {
  normalizeNoRawat(noRawat) {
    const value = String(noRawat || '').trim();
    if (!value) {
      return '';
    }

    if (value.includes('/')) {
      return value;
    }

    if (value.length >= 8) {
      return `${value.substring(0, 4)}/${value.substring(4, 6)}/${value.substring(6, 8)}/${value.substring(8)}`;
    }

    return value;
  }

  normalizeStatusLanjut(statusLanjut) {
    return String(statusLanjut || '').trim() === 'Ralan' ? 'Ralan' : 'Ranap';
  }

  formatDateOnly(value) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  calculateDayOffset(startDate, actionDate) {
    const start = new Date(startDate);
    const action = new Date(actionDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(action.getTime())) {
      return null;
    }

    const diffMs = action.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1) {
      return 1;
    }

    return diffDays > 14 ? 14 : diffDays;
  }

  combineDateTime(dateValue, timeValue = '00:00:00') {
    const datePart = String(dateValue || '').trim();
    const timePart = String(timeValue || '').trim() || '00:00:00';
    if (!datePart) {
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    const combined = new Date(`${datePart}T${timePart}`);
    if (Number.isNaN(combined.getTime())) {
      return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    return combined.toISOString().slice(0, 19).replace('T', ' ');
  }

  complianceLabel(value) {
    if (value >= 80) return 'Sangat Patuh';
    if (value >= 60) return 'Patuh';
    if (value >= 40) return 'Kurang Patuh';
    return 'Tidak Patuh';
  }

  sanitizeLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  inferUraianKegiatan(kategori, aktivitas) {
    const category = this.sanitizeLabel(kategori);
    const activity = this.sanitizeLabel(aktivitas).toLowerCase();

    if (category === 'Assessment') {
      if (activity.includes('monitor')) return 'Monitoring dan Evaluasi';
      return 'Asesmen Awal';
    }
    if (category === 'Laboratorium') return 'Pemeriksaan Laboratorium';
    if (category === 'Radiologi') return 'Pemeriksaan Radiologi';
    if (category === 'Obat') return 'Farmasi';
    if (category === 'Tindakan') return 'Tatalaksana / Intervensi';
    if (category === 'Monitoring') return 'Monitoring dan Evaluasi';
    return category || 'Monitoring';
  }

  buildInClause(values) {
    const cleanValues = values.filter(Boolean);
    return {
      placeholders: cleanValues.map(() => '?').join(','),
      params: cleanValues
    };
  }

  async getRegistration(noRkmMedis, noRawat) {
    const [rows] = await db.execute(
      `SELECT
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk,
        p.tgl_lahir,
        p.alamat,
        p.no_tlp,
        r.no_rawat,
        r.tgl_registrasi,
        r.jam_reg,
        r.kd_dokter,
        d.nm_dokter,
        r.kd_poli,
        po.nm_poli,
        r.no_reg,
        r.kd_pj,
        pj.png_jawab,
        r.status_lanjut,
        TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) AS umur
      FROM pasien p
      INNER JOIN reg_periksa r ON p.no_rkm_medis = r.no_rkm_medis
      LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
      LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
      LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
      WHERE p.no_rkm_medis = ? AND r.no_rawat = ?
      LIMIT 1`,
      [noRkmMedis, noRawat]
    );

    return rows[0] || null;
  }

  async getDiagnoses(noRawat, statusLanjut) {
    const [rows] = await db.execute(
      `SELECT dp.kd_penyakit, COALESCE(py.nm_penyakit, '') AS nm_penyakit, dp.prioritas, dp.status
       FROM diagnosa_pasien dp
       LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
       WHERE dp.no_rawat = ? AND dp.status = ?
       ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC`,
      [noRawat, statusLanjut]
    );

    if (rows.length) {
      return rows;
    }

    const [fallbackRows] = await db.execute(
      `SELECT dp.kd_penyakit, COALESCE(py.nm_penyakit, '') AS nm_penyakit, dp.prioritas, dp.status
       FROM diagnosa_pasien dp
       LEFT JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
       WHERE dp.no_rawat = ?
       ORDER BY dp.prioritas ASC, dp.kd_penyakit ASC`,
      [noRawat]
    );
    return fallbackRows;
  }

  async getExistingPatientPathway(noRawat) {
    const [rows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        p.clinical_pathway_id,
        p.kd_penyakit,
        p.tanggal_mulai,
        p.tanggal_selesai,
        p.status AS status_cp,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan AS status_layanan,
        c.target_los,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      WHERE p.no_rawat = ?
      LIMIT 1`,
      [noRawat]
    );

    return rows[0] || null;
  }

  async getMasterRecommendations(diagnosisCodes, statusLanjut) {
    if (!diagnosisCodes.length) {
      return [];
    }

    const { placeholders, params } = this.buildInClause(diagnosisCodes);
    const baseQuery = `
      SELECT
        c.id,
        c.kode_cp,
        c.nama_cp,
        c.jenis_layanan AS status_layanan,
        c.target_los,
        c.confidence_score,
        COUNT(DISTINCT d.kd_penyakit) AS matched_icd_count,
        MIN(d.prioritas) AS min_prioritas,
        GROUP_CONCAT(DISTINCT CONCAT(d.kd_penyakit, '::', COALESCE(py.nm_penyakit, '')) ORDER BY d.prioritas ASC SEPARATOR '||') AS matched_icd_labels
      FROM mlite_clinical_pathway c
      INNER JOIN mlite_clinical_pathway_diagnosis d ON d.clinical_pathway_id = c.id
      LEFT JOIN penyakit py ON py.kd_penyakit = d.kd_penyakit
      WHERE d.kd_penyakit IN (${placeholders})
        AND c.aktif = 'Ya'
        %STATUS_FILTER%
      GROUP BY c.id, c.kode_cp, c.nama_cp, c.jenis_layanan, c.target_los, c.confidence_score
      ORDER BY matched_icd_count DESC, min_prioritas ASC, c.confidence_score DESC, c.nama_cp ASC
      LIMIT 10
    `;

    const [withStatus] = await db.execute(
      baseQuery.replace('%STATUS_FILTER%', 'AND c.jenis_layanan = ?'),
      [...params, statusLanjut]
    );
    let rows = withStatus;
    if (!rows.length) {
      const [fallbackRows] = await db.execute(
        baseQuery.replace('%STATUS_FILTER%', ''),
        params
      );
      rows = fallbackRows;
    }

    return rows.map((row) => ({
      ...row,
      matched_diagnoses: String(row.matched_icd_labels || '')
        .split('||')
        .filter(Boolean)
        .map((item) => {
          const [kd_penyakit, nm_penyakit = ''] = item.split('::');
          return { kd_penyakit, nm_penyakit };
        })
    }));
  }

  async getMasterTemplate(clinicalPathwayId) {
    if (!clinicalPathwayId) {
      return [];
    }

    const [rows] = await db.execute(
      `SELECT
        d.hari_ke,
        COALESCE(d.label_hari, CONCAT('Hari ', d.hari_ke)) AS label_hari,
        a.kategori,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama,
        COALESCE(a.keterangan, '') AS keterangan,
        a.evidence_frequency,
        a.evidence_percentage
      FROM mlite_clinical_pathway_activity a
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      WHERE d.clinical_pathway_id = ?
      ORDER BY d.hari_ke ASC, a.urutan ASC, a.id ASC`,
      [clinicalPathwayId]
    );

    return this.groupTemplateRows(rows, { sourceCaseCount: 0, generatedFromHistory: false });
  }

  groupTemplateRows(rows, options = {}) {
    const grouped = new Map();

    rows.forEach((row) => {
      const hariKe = Number(row.hari_ke || 1);
      if (!grouped.has(hariKe)) {
        grouped.set(hariKe, {
          hari_ke: hariKe,
          label_hari: row.label_hari || `Hari ${hariKe}`,
          activities: []
        });
      }

      grouped.get(hariKe).activities.push({
        kategori: row.kategori,
        uraian_kegiatan: row.uraian_kegiatan || this.inferUraianKegiatan(row.kategori, row.item_nama),
        item_nama: row.item_nama,
        keterangan: row.keterangan || '',
        frequency: Number(row.evidence_frequency || 0),
        coverage_percentage: Number(row.evidence_percentage || 0)
      });
    });

    return {
      source_case_count: Number(options.sourceCaseCount || 0),
      generated_from_history: Boolean(options.generatedFromHistory),
      days: Array.from(grouped.values()).sort((a, b) => a.hari_ke - b.hari_ke)
    };
  }

  addHistoricalAggregate(aggregateMap, caseCount, payload) {
    const {
      noRawat,
      startDate,
      actionDate,
      kategori,
      itemNama,
      keterangan = '',
      sourceType = ''
    } = payload;

    const dayOffset = this.calculateDayOffset(startDate, actionDate);
    const cleanItem = this.sanitizeLabel(itemNama);
    if (!dayOffset || !cleanItem) {
      return;
    }

    const category = kategori;
    const key = `${dayOffset}|${category}|${cleanItem}`;
    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, {
        hari_ke: dayOffset,
        label_hari: `Hari ${dayOffset}`,
        kategori: category,
        uraian_kegiatan: this.inferUraianKegiatan(category, cleanItem),
        item_nama: cleanItem,
        keterangan: this.sanitizeLabel(keterangan),
        frequency: 0,
        cases: new Set(),
        source_type: sourceType
      });
    }

    const entry = aggregateMap.get(key);
    entry.frequency += 1;
    entry.cases.add(noRawat);
    entry.coverage_percentage = caseCount > 0
      ? Number(((entry.cases.size / caseCount) * 100).toFixed(2))
      : 0;
  }

  async buildHistoricalTemplate({ diagnosisCodes, statusLanjut }) {
    if (!diagnosisCodes.length) {
      return { source_case_count: 0, generated_from_history: true, days: [] };
    }

    const { placeholders, params } = this.buildInClause(diagnosisCodes);
    const [caseRows] = await db.execute(
      `SELECT DISTINCT
        rp.no_rawat,
        COALESCE(ki.tgl_masuk, rp.tgl_registrasi) AS start_date
      FROM reg_periksa rp
      INNER JOIN diagnosa_pasien dp ON dp.no_rawat = rp.no_rawat AND dp.status = rp.status_lanjut
      LEFT JOIN (
        SELECT no_rawat, MIN(tgl_masuk) AS tgl_masuk
        FROM kamar_inap
        GROUP BY no_rawat
      ) ki ON ki.no_rawat = rp.no_rawat
      WHERE dp.kd_penyakit IN (${placeholders})
        AND rp.status_lanjut = ?
        AND rp.tgl_registrasi >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      ORDER BY rp.tgl_registrasi DESC
      LIMIT 120`,
      [...params, statusLanjut]
    );

    if (!caseRows.length) {
      return { source_case_count: 0, generated_from_history: true, days: [] };
    }

    const caseCount = caseRows.length;
    const caseStartMap = new Map(caseRows.map((row) => [row.no_rawat, this.formatDateOnly(row.start_date)]));
    const caseNoRawat = caseRows.map((row) => row.no_rawat);
    const caseClause = this.buildInClause(caseNoRawat);
    const aggregateMap = new Map();
    const examTable = statusLanjut === 'Ranap' ? 'pemeriksaan_ranap' : 'pemeriksaan_ralan';
    const procedurePrefix = statusLanjut === 'Ranap' ? 'rawat_inap' : 'rawat_jl';
    const procedureReferenceTable = statusLanjut === 'Ranap' ? 'jns_perawatan_inap' : 'jns_perawatan';

    const [examRows, procedureRows, medicationRows, labRows, radiologyRows] = await Promise.all([
      db.execute(
        `SELECT no_rawat, tgl_perawatan
         FROM ${examTable}
         WHERE no_rawat IN (${caseClause.placeholders})
         GROUP BY no_rawat, tgl_perawatan`,
        caseClause.params
      ),
      db.execute(
        `SELECT tindakan.no_rawat, tindakan.tgl_perawatan, jp.nm_perawatan
         FROM (
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_dr WHERE no_rawat IN (${caseClause.placeholders})
           UNION ALL
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_pr WHERE no_rawat IN (${caseClause.placeholders})
           UNION ALL
           SELECT no_rawat, kd_jenis_prw, tgl_perawatan FROM ${procedurePrefix}_drpr WHERE no_rawat IN (${caseClause.placeholders})
         ) tindakan
         LEFT JOIN ${procedureReferenceTable} jp ON jp.kd_jenis_prw = tindakan.kd_jenis_prw
         WHERE COALESCE(jp.nm_perawatan, '') <> ''`,
        [...caseClause.params, ...caseClause.params, ...caseClause.params]
      ),
      db.execute(
        `SELECT ro.no_rawat, ro.tgl_peresepan, db.nama_brng
         FROM resep_obat ro
         INNER JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
         LEFT JOIN databarang db ON db.kode_brng = rd.kode_brng
         WHERE ro.no_rawat IN (${caseClause.placeholders})
           AND ro.status = ?
           AND COALESCE(db.nama_brng, '') <> ''`,
        [...caseClause.params, statusLanjut]
      ),
      db.execute(
        `SELECT pl.no_rawat, pl.tgl_permintaan, jpl.nm_perawatan
         FROM permintaan_lab pl
         INNER JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder
         LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
         WHERE pl.no_rawat IN (${caseClause.placeholders})
           AND pl.status = ?
           AND COALESCE(jpl.nm_perawatan, '') <> ''`,
        [...caseClause.params, statusLanjut]
      ),
      db.execute(
        `SELECT pr.no_rawat, pr.tgl_permintaan, jpr.nm_perawatan
         FROM permintaan_radiologi pr
         INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
         LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
         WHERE pr.no_rawat IN (${caseClause.placeholders})
           AND pr.status = ?
           AND COALESCE(jpr.nm_perawatan, '') <> ''`,
        [...caseClause.params, statusLanjut]
      )
    ]);

    examRows.forEach((row) => {
      const startDate = caseStartMap.get(row.no_rawat);
      const dayOffset = this.calculateDayOffset(startDate, row.tgl_perawatan);
      if (!dayOffset) return;

      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate,
        actionDate: row.tgl_perawatan,
        kategori: dayOffset === 1 ? 'Assessment' : 'Monitoring',
        itemNama: dayOffset === 1 ? 'Asesmen awal medis dan keperawatan' : 'Monitoring klinis harian',
        sourceType: 'examination'
      });
    });

    procedureRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_perawatan,
        kategori: 'Tindakan',
        itemNama: row.nm_perawatan,
        sourceType: 'procedure'
      });
    });

    medicationRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_peresepan,
        kategori: 'Obat',
        itemNama: row.nama_brng,
        sourceType: 'medication'
      });
    });

    labRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_permintaan,
        kategori: 'Laboratorium',
        itemNama: row.nm_perawatan,
        sourceType: 'laboratory'
      });
    });

    radiologyRows.forEach((row) => {
      this.addHistoricalAggregate(aggregateMap, caseCount, {
        noRawat: row.no_rawat,
        startDate: caseStartMap.get(row.no_rawat),
        actionDate: row.tgl_permintaan,
        kategori: 'Radiologi',
        itemNama: row.nm_perawatan,
        sourceType: 'radiology'
      });
    });

    const minimumFrequency = caseCount >= 10 ? 2 : 1;
    const groupedDays = new Map();

    Array.from(aggregateMap.values())
      .filter((item) => item.frequency >= minimumFrequency)
      .sort((a, b) => {
        if (a.hari_ke !== b.hari_ke) return a.hari_ke - b.hari_ke;
        const categoryOrder = CATEGORY_ORDER.indexOf(a.kategori) - CATEGORY_ORDER.indexOf(b.kategori);
        if (categoryOrder !== 0) return categoryOrder;
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        return a.item_nama.localeCompare(b.item_nama);
      })
      .forEach((item) => {
        if (!groupedDays.has(item.hari_ke)) {
          groupedDays.set(item.hari_ke, {
            hari_ke: item.hari_ke,
            label_hari: item.label_hari,
            activities: []
          });
        }

        const dayEntry = groupedDays.get(item.hari_ke);
        const sameCategoryCount = dayEntry.activities.filter((activity) => activity.kategori === item.kategori).length;
        if (sameCategoryCount >= 5) {
          return;
        }

        dayEntry.activities.push({
          kategori: item.kategori,
          uraian_kegiatan: item.uraian_kegiatan,
          item_nama: item.item_nama,
          keterangan: item.keterangan,
          frequency: item.frequency,
          coverage_percentage: item.coverage_percentage,
          source_type: item.source_type
        });
      });

    return {
      source_case_count: caseCount,
      generated_from_history: true,
      days: Array.from(groupedDays.values()).sort((a, b) => a.hari_ke - b.hari_ke)
    };
  }

  async ensureMasterTemplateFromHistory(connection, clinicalPathwayId, historicalTemplate) {
    if (!historicalTemplate?.days?.length) {
      return;
    }

    const [existing] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM mlite_clinical_pathway_activity a
       INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
       WHERE d.clinical_pathway_id = ?`,
      [clinicalPathwayId]
    );
    const existingCount = Number(existing[0]?.total || 0);
    if (existingCount > 0) {
      return;
    }

    for (const day of historicalTemplate.days) {
      await connection.execute(
        `INSERT INTO mlite_clinical_pathway_day (clinical_pathway_id, hari_ke, label_hari, tujuan_harian)
         VALUES (?, ?, ?, '')
         ON DUPLICATE KEY UPDATE label_hari = VALUES(label_hari)`,
        [clinicalPathwayId, day.hari_ke, day.label_hari || `Hari ${day.hari_ke}`]
      );

      const [dayRows] = await connection.execute(
        `SELECT id FROM mlite_clinical_pathway_day WHERE clinical_pathway_id = ? AND hari_ke = ? LIMIT 1`,
        [clinicalPathwayId, day.hari_ke]
      );
      const dayId = dayRows[0]?.id;
      if (!dayId) {
        continue;
      }

      let order = 0;
      for (const activity of day.activities) {
        order += 1;
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_activity
            (clinical_pathway_day_id, kategori, uraian_kegiatan, sumber_tabel, item_kode, item_nama, keterangan, evidence_frequency, evidence_percentage, evidence_status, wajib, urutan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Direkomendasikan', 'Ya', ?)` ,
          [
            dayId,
            activity.kategori,
            activity.uraian_kegiatan || this.inferUraianKegiatan(activity.kategori, activity.item_nama),
            activity.source_type || 'history',
            null,
            activity.item_nama,
            activity.keterangan || '',
            Number(activity.frequency || 0),
            Number(activity.coverage_percentage || 0),
            order
          ]
        );
      }
    }
  }

  async syncCompliance(connection, patientId) {
    const [rows] = await connection.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS done_total,
        SUM(CASE WHEN status = 'Missed' THEN 1 ELSE 0 END) AS missed_total
      FROM mlite_clinical_pathway_execution
      WHERE clinical_pathway_patient_id = ?`,
      [patientId]
    );

    const totals = rows[0] || {};
    const planned = Number(totals.total || 0);
    const done = Number(totals.done_total || 0);
    const missed = Number(totals.missed_total || 0);
    const percentage = planned > 0 ? Number(((done / planned) * 100).toFixed(2)) : 0;

    await connection.execute(
      `INSERT INTO mlite_clinical_pathway_compliance
        (clinical_pathway_patient_id, planned_activity, completed_activity, missed_activity, compliance_percentage, kategori_kepatuhan, last_calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         planned_activity = VALUES(planned_activity),
         completed_activity = VALUES(completed_activity),
         missed_activity = VALUES(missed_activity),
         compliance_percentage = VALUES(compliance_percentage),
         kategori_kepatuhan = VALUES(kategori_kepatuhan),
         last_calculated_at = VALUES(last_calculated_at)`,
      [patientId, planned, done, missed, percentage, this.complianceLabel(percentage)]
    );
  }

  normalizePatientStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'selesai') return 'Selesai';
    if (value === 'drop') return 'Drop';
    if (value === 'draft') return 'Draft';
    return 'Aktif';
  }

  normalizeExecutionStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'completed' || value === 'selesai') return 'Completed';
    if (value === 'missed' || value === 'terlewat') return 'Missed';
    if (value === 'variance') return 'Variance';
    return 'Planned';
  }

  async refreshPatientMonitoring(connection, patientId) {
    const [patientRows] = await connection.execute(
      `SELECT
        p.id,
        p.tanggal_mulai,
        p.tanggal_selesai,
        c.nama_cp,
        c.target_los
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      WHERE p.id = ?
      LIMIT 1`,
      [patientId]
    );
    const patient = patientRows[0];
    if (!patient) {
      throw new Error('Data pasien Clinical Pathway tidak ditemukan.');
    }

    await connection.execute(
      `DELETE FROM mlite_clinical_pathway_variance
       WHERE clinical_pathway_patient_id = ?
         AND kategori_variance IN ('Administrasi', 'LOS')`,
      [patientId]
    );

    const [executionRows] = await connection.execute(
      `SELECT
        e.id,
        e.status,
        a.wajib,
        a.item_nama AS aktivitas
      FROM mlite_clinical_pathway_execution e
      INNER JOIN mlite_clinical_pathway_activity a ON a.id = e.clinical_pathway_activity_id
      WHERE e.clinical_pathway_patient_id = ?`,
      [patientId]
    );

    for (const row of executionRows) {
      if (String(row.wajib || 'Ya') === 'Ya' && String(row.status || 'Planned') === 'Planned') {
        await connection.execute(
          `UPDATE mlite_clinical_pathway_execution
           SET status = 'Missed', catatan = 'Ditandai otomatis saat refresh monitoring.'
           WHERE id = ?`,
          [row.id]
        );
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_variance
            (clinical_pathway_patient_id, clinical_pathway_execution_id, kategori_variance, penyebab, deskripsi, severity, tanggal_variance, status_tindak_lanjut)
           VALUES (?, ?, 'Administrasi', 'Aktivitas wajib terlewat', ?, 'Sedang', NOW(), 'Open')`,
          [patientId, row.id, `Aktivitas wajib belum direalisasikan: ${row.aktivitas}`]
        );
      }
    }

    const startDate = new Date(patient.tanggal_mulai);
    if (!Number.isNaN(startDate.getTime()) && Number(patient.target_los || 0) > 0) {
      const endDate = patient.tanggal_selesai ? new Date(patient.tanggal_selesai) : new Date();
      const losActual = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      if (losActual > Number(patient.target_los)) {
        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_variance
            (clinical_pathway_patient_id, kategori_variance, penyebab, deskripsi, severity, tanggal_variance, status_tindak_lanjut)
           VALUES (?, 'LOS', 'Melebihi target lama rawat', ?, 'Sedang', NOW(), 'Open')`,
          [patientId, `LOS aktual melebihi target untuk ${patient.nama_cp}`]
        );
      }
    }

    await this.syncCompliance(connection, patientId);
  }

  async getMonitoringDetail(patientId) {
    const [patientRows] = await db.execute(
      `SELECT
        p.id,
        p.no_rawat,
        p.kd_penyakit,
        p.status AS status_cp,
        p.tanggal_mulai,
        p.tanggal_selesai,
        c.kode_cp,
        c.nama_cp,
        c.target_los,
        c.jenis_layanan AS status_layanan,
        rp.no_rkm_medis,
        pa.nm_pasien,
        py.nm_penyakit,
        COALESCE(comp.compliance_percentage, 0) AS compliance_percentage,
        (
          SELECT COUNT(*)
          FROM mlite_clinical_pathway_variance v
          WHERE v.clinical_pathway_patient_id = p.id AND v.status_tindak_lanjut = 'Open'
        ) AS variance_count
      FROM mlite_clinical_pathway_patient p
      INNER JOIN mlite_clinical_pathway c ON c.id = p.clinical_pathway_id
      LEFT JOIN reg_periksa rp ON rp.no_rawat = p.no_rawat
      LEFT JOIN pasien pa ON pa.no_rkm_medis = rp.no_rkm_medis
      LEFT JOIN penyakit py ON py.kd_penyakit = p.kd_penyakit
      LEFT JOIN mlite_clinical_pathway_compliance comp ON comp.clinical_pathway_patient_id = p.id
      WHERE p.id = ?
      LIMIT 1`,
      [patientId]
    );

    const patient = patientRows[0] || null;
    if (!patient) {
      return {
        success: false,
        message: 'Data monitoring Clinical Pathway tidak ditemukan',
        data: null
      };
    }

    const [executionRows] = await db.execute(
      `SELECT
        e.id,
        e.clinical_pathway_patient_id AS cp_patient_id,
        e.hari_ke,
        e.status,
        e.tanggal_rencana,
        e.tanggal_realisasi,
        COALESCE(e.catatan, '') AS catatan,
        a.kategori,
        COALESCE(d.label_hari, CONCAT('Hari ', e.hari_ke)) AS kegiatan,
        COALESCE(a.uraian_kegiatan, '') AS uraian_kegiatan,
        a.item_nama AS aktivitas,
        COALESCE(a.keterangan, '') AS keterangan
      FROM mlite_clinical_pathway_execution e
      INNER JOIN mlite_clinical_pathway_activity a ON a.id = e.clinical_pathway_activity_id
      INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
      WHERE e.clinical_pathway_patient_id = ?
      ORDER BY e.hari_ke ASC, a.urutan ASC, e.id ASC`,
      [patientId]
    );

    const [varianceRows] = await db.execute(
      `SELECT
        v.id,
        COALESCE(ex.hari_ke, 0) AS hari_ke,
        v.kategori_variance,
        v.deskripsi,
        v.status_tindak_lanjut AS status,
        v.severity,
        v.tanggal_variance
      FROM mlite_clinical_pathway_variance v
      LEFT JOIN mlite_clinical_pathway_execution ex ON ex.id = v.clinical_pathway_execution_id
      WHERE v.clinical_pathway_patient_id = ?
      ORDER BY hari_ke ASC, v.id ASC`,
      [patientId]
    );

    return {
      success: true,
      message: 'Detail monitoring Clinical Pathway berhasil diambil',
      data: {
        patient,
        execution: executionRows,
        variance: varianceRows
      }
    };
  }

  async getMonitoringDetailByNoRawat(noRawat) {
    const normalizedNoRawat = this.normalizeNoRawat(noRawat);
    const [rows] = await db.execute(
      `SELECT id FROM mlite_clinical_pathway_patient WHERE no_rawat = ? LIMIT 1`,
      [normalizedNoRawat]
    );

    const patientId = Number(rows[0]?.id || 0);
    if (!patientId) {
      return {
        success: false,
        message: 'Clinical Pathway pasien belum digenerate, monitoring belum tersedia.',
        data: null
      };
    }

    return this.getMonitoringDetail(patientId);
  }

  async updateExecutionStatus(patientId, executionId, status) {
    let connection;
    try {
      connection = await db.getConnection();

      const normalizedStatus = this.normalizeExecutionStatus(status);
      await connection.execute(
        `UPDATE mlite_clinical_pathway_execution
         SET status = ?, tanggal_realisasi = ?, sumber_data = 'manual'
         WHERE id = ? AND clinical_pathway_patient_id = ?`,
        [
          normalizedStatus,
          normalizedStatus === 'Completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          executionId,
          patientId
        ]
      );

      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat mengubah status aktivitas monitoring',
        error: error.message
      };
    }
  }

  async updatePatientStatus(patientId, status) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const normalizedStatus = this.normalizePatientStatus(status);
      await connection.execute(
        `UPDATE mlite_clinical_pathway_patient
         SET status = ?, tanggal_selesai = ?
         WHERE id = ?`,
        [
          normalizedStatus,
          normalizedStatus === 'Selesai' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          patientId
        ]
      );

      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat mengubah status pasien Clinical Pathway',
        error: error.message
      };
    }
  }

  async refreshMonitoring(patientId) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      await this.refreshPatientMonitoring(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      return this.getMonitoringDetail(patientId);
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      return {
        success: false,
        message: 'Terjadi kesalahan saat refresh monitoring Clinical Pathway',
        error: error.message
      };
    }
  }

  async getPatientData(noRkmMedis, noRawat, preferredClinicalPathwayId = null) {
    try {
      const normalizedNoRawat = this.normalizeNoRawat(noRawat);
      const registration = await this.getRegistration(noRkmMedis, normalizedNoRawat);
      if (!registration) {
        return {
          success: false,
          message: 'Data pasien tidak ditemukan',
          data: null
        };
      }

      const statusLanjut = this.normalizeStatusLanjut(registration.status_lanjut);
      const diagnoses = await this.getDiagnoses(normalizedNoRawat, statusLanjut);
      const diagnosisCodes = diagnoses.map((item) => String(item.kd_penyakit || '').trim()).filter(Boolean);
      const existing = await this.getExistingPatientPathway(normalizedNoRawat);
      const masterRecommendations = await this.getMasterRecommendations(diagnosisCodes, statusLanjut);
      const requestedClinicalPathwayId = Number(preferredClinicalPathwayId || 0);
      const availableClinicalPathwayIds = new Set(masterRecommendations.map((item) => Number(item.id)));
      const selectedClinicalPathwayId = Number(
        existing?.clinical_pathway_id ||
        (requestedClinicalPathwayId && availableClinicalPathwayIds.has(requestedClinicalPathwayId) ? requestedClinicalPathwayId : 0) ||
        masterRecommendations[0]?.id ||
        0
      );
      const masterTemplate = selectedClinicalPathwayId
        ? await this.getMasterTemplate(selectedClinicalPathwayId)
        : { source_case_count: 0, generated_from_history: false, days: [] };
      const historicalTemplate = await this.buildHistoricalTemplate({
        diagnosisCodes,
        statusLanjut
      });

      return {
        success: true,
        message: 'Data Clinical Pathway berhasil diambil',
        data: {
          registration: {
            ...registration,
            status_lanjut: statusLanjut
          },
          diagnoses,
          existing,
          master_recommendations: masterRecommendations,
          selected_clinical_pathway_id: selectedClinicalPathwayId || null,
          master_template: masterTemplate,
          historical_template: historicalTemplate
        }
      };
    } catch (error) {
      console.error('Error in getPatientData:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat mengambil data Clinical Pathway',
        error: error.message,
        data: null
      };
    }
  }

  async generatePatientClinicalPathway(payload) {
    let connection;
    try {
      const normalizedNoRawat = this.normalizeNoRawat(payload.no_rawat);
      const normalizedNoRkmMedis = String(payload.no_rkm_medis || '').trim();
      const preview = await this.getPatientData(normalizedNoRkmMedis, normalizedNoRawat);
      if (!preview.success || !preview.data) {
        return {
          success: false,
          message: preview.message || 'Preview Clinical Pathway tidak ditemukan'
        };
      }

      const registration = preview.data.registration;
      const diagnoses = preview.data.diagnoses || [];
      const selectedClinicalPathwayId = Number(
        payload.clinical_pathway_id ||
        preview.data.existing?.clinical_pathway_id ||
        preview.data.master_recommendations?.[0]?.id ||
        0
      );

      if (!selectedClinicalPathwayId) {
        return {
          success: false,
          message: 'Belum ada master Clinical Pathway yang cocok untuk diagnosis pasien ini.'
        };
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      await this.ensureMasterTemplateFromHistory(
        connection,
        selectedClinicalPathwayId,
        preview.data.historical_template
      );

      const [templateRows] = await connection.execute(
        `SELECT
          a.id AS activity_id,
          d.hari_ke
        FROM mlite_clinical_pathway_activity a
        INNER JOIN mlite_clinical_pathway_day d ON d.id = a.clinical_pathway_day_id
        WHERE d.clinical_pathway_id = ?
        ORDER BY d.hari_ke ASC, a.urutan ASC, a.id ASC`,
        [selectedClinicalPathwayId]
      );

      if (!templateRows.length) {
        throw new Error('Template harian Clinical Pathway masih kosong, termasuk dari histori 1 tahun terakhir.');
      }

      const primaryDiagnosis = diagnoses[0] || {};
      const tanggalMulai = this.combineDateTime(registration.tgl_registrasi, registration.jam_reg);
      const [existingRows] = await connection.execute(
        `SELECT id FROM mlite_clinical_pathway_patient WHERE no_rawat = ? LIMIT 1`,
        [normalizedNoRawat]
      );
      let patientId = Number(existingRows[0]?.id || 0);

      if (patientId) {
        await connection.execute(
          `UPDATE mlite_clinical_pathway_patient
           SET clinical_pathway_id = ?, kd_penyakit = ?, tanggal_mulai = ?, tanggal_selesai = NULL, status = 'Aktif', auto_generated = 'Ya'
           WHERE id = ?`,
          [selectedClinicalPathwayId, primaryDiagnosis.kd_penyakit || null, tanggalMulai, patientId]
        );
        await connection.execute(`DELETE FROM mlite_clinical_pathway_execution WHERE clinical_pathway_patient_id = ?`, [patientId]);
        await connection.execute(`DELETE FROM mlite_clinical_pathway_variance WHERE clinical_pathway_patient_id = ?`, [patientId]);
        await connection.execute(`DELETE FROM mlite_clinical_pathway_compliance WHERE clinical_pathway_patient_id = ?`, [patientId]);
      } else {
        const [insertResult] = await connection.execute(
          `INSERT INTO mlite_clinical_pathway_patient
            (no_rawat, clinical_pathway_id, kd_penyakit, tanggal_mulai, tanggal_selesai, status, auto_generated)
           VALUES (?, ?, ?, ?, NULL, 'Aktif', 'Ya')`,
          [normalizedNoRawat, selectedClinicalPathwayId, primaryDiagnosis.kd_penyakit || null, tanggalMulai]
        );
        patientId = Number(insertResult.insertId);
      }

      for (const templateRow of templateRows) {
        const plannedDate = new Date(tanggalMulai.replace(' ', 'T'));
        plannedDate.setDate(plannedDate.getDate() + (Number(templateRow.hari_ke || 1) - 1));

        await connection.execute(
          `INSERT INTO mlite_clinical_pathway_execution
            (clinical_pathway_patient_id, clinical_pathway_activity_id, hari_ke, tanggal_rencana, status, sumber_data)
           VALUES (?, ?, ?, ?, 'Planned', 'generator')`,
          [
            patientId,
            Number(templateRow.activity_id),
            Number(templateRow.hari_ke || 1),
            plannedDate.toISOString().slice(0, 10)
          ]
        );
      }

      await this.syncCompliance(connection, patientId);
      await connection.commit();
      connection.release();
      connection = null;

      const refreshed = await this.getPatientData(normalizedNoRkmMedis, normalizedNoRawat);
      return {
        success: true,
        message: 'Clinical Pathway pasien berhasil digenerate',
        data: {
          patient_id: patientId,
          no_rawat: normalizedNoRawat,
          clinical_pathway_id: selectedClinicalPathwayId,
          diagnosis_code: primaryDiagnosis.kd_penyakit || null,
          generated_activity_count: templateRows.length,
          preview: refreshed.data || null
        }
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }

      console.error('Error in generatePatientClinicalPathway:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat generate Clinical Pathway pasien',
        error: error.message
      };
    }
  }

  async saveClinicalPathway(pathwayData) {
    return this.generatePatientClinicalPathway(pathwayData);
  }
}

export { ClinicalPathwayService };
