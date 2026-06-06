import db from '../config/database.js';

class GetMedicalRecordService {
  static DEFAULT_LIMIT = 5;

  // Utility function to format date only (no time conversion)
  static formatDateOnly(dateStr) {
    if (!dateStr) return '';
    
    // Handle MySQL DATE format (YYYY-MM-DD)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle Date object or ISO string
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '';
    }
  }

  // Helper function to fetch examinations
  static async fetchExaminations(noRawat, type) {
    const table = type === 'ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
    const examQuery = `SELECT p1.*, p2.nama FROM ${table} p1 LEFT JOIN pegawai p2 ON p2.nik = p1.nip WHERE p1.no_rawat = ? ORDER BY p1.tgl_perawatan DESC, p1.jam_rawat DESC`;
    const [rows] = await db.execute(examQuery, [noRawat]);
    
    return rows.map(row => ({
      tanggal: this.formatDateOnly(row.tgl_perawatan) + ' ' + row.jam_rawat,
      tgl_perawatan: this.formatDateOnly(row.tgl_perawatan),
      jam_rawat: row.jam_rawat,
      tekanan_darah: row.tensi || '',
      nadi: row.nadi || '',
      respirasi: row.respirasi || '',
      suhu: row.suhu_tubuh || '',
      gcs: row.gcs || '',
      s: row.keluhan || '',
      o: row.pemeriksaan || '',
      a: row.penilaian || '',
      p: row.rtl || '',
      i: row.instruksi || '',
      e: row.evaluasi || '',
      pegawai: row.nama || ''
    }));
  }

  static async fetchProcedures(noRawat, type) {
    const tablePrefix = type === 'ralan' ? 'rawat_jl' : 'rawat_inap';
    const procedureReferenceTable = type === 'ralan' ? 'jns_perawatan' : 'jns_perawatan_inap';
    const proceduresQuery = `
      SELECT
        tindakan.tgl_perawatan,
        tindakan.jam_rawat,
        tindakan.kd_jenis_prw,
        tindakan.biaya_rawat,
        tindakan.nama_pelaksana,
        jp.nm_perawatan
      FROM (
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          COALESCE(d.nm_dokter, 'Dokter') AS nama_pelaksana
        FROM ${tablePrefix}_dr tindakan
        LEFT JOIN dokter d ON tindakan.kd_dokter = d.kd_dokter
        WHERE no_rawat = ?
        UNION ALL
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          COALESCE(p.nama, 'Perawat') AS nama_pelaksana
        FROM ${tablePrefix}_pr tindakan
        LEFT JOIN pegawai p ON tindakan.nip = p.nik
        WHERE no_rawat = ?
        UNION ALL
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          CONCAT_WS(' & ', d.nm_dokter, p.nama) AS nama_pelaksana
        FROM ${tablePrefix}_drpr tindakan
        LEFT JOIN dokter d ON tindakan.kd_dokter = d.kd_dokter
        LEFT JOIN pegawai p ON tindakan.nip = p.nik
        WHERE no_rawat = ?
      ) tindakan
      LEFT JOIN ${procedureReferenceTable} jp ON tindakan.kd_jenis_prw = jp.kd_jenis_prw
      ORDER BY tindakan.tgl_perawatan DESC, tindakan.jam_rawat DESC, jp.nm_perawatan ASC
    `;
    const [rows] = await db.execute(proceduresQuery, [noRawat, noRawat, noRawat]);

    return rows.map((row) => ({
      tanggal: this.formatDateOnly(row.tgl_perawatan) + ' ' + row.jam_rawat,
      nm_perawatan: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama_pelaksana: row.nama_pelaksana || '-',
      hasil: row.nama_pelaksana || '-',
      biaya_rawat: row.biaya_rawat || 0
    }));
  }

  // Helper function to fetch medications using 2-step approach
  static async fetchMedications(noRawat, status) {
    // Step 1: Get list of unique prescriptions
    const prescQuery = `
      SELECT DISTINCT no_resep, tgl_perawatan, jam
      FROM resep_obat 
      WHERE no_rawat = ? AND status = ?
      ORDER BY tgl_perawatan, jam
    `;
    const [prescRows] = await db.execute(prescQuery, [noRawat, status]);
    const medications = [];
    
    // Step 2: For each prescription, fetch detailed medications
    for (const prescRow of prescRows) {
      // Skip if tgl_perawatan or jam is NULL
      if (!prescRow.tgl_perawatan || !prescRow.jam) {
        continue;
      }
      
      const detailQuery = `
        SELECT dro.kode_brng, dro.jml, ap.aturan, ob.nama_brng
        FROM detail_pemberian_obat dro
        LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
        LEFT JOIN aturan_pakai ap ON dro.no_rawat = ap.no_rawat AND dro.kode_brng = ap.kode_brng AND ap.tgl_perawatan = ? AND ap.jam = ? 
        WHERE dro.tgl_perawatan = ?
        AND dro.jam = ?
        ORDER BY ob.nama_brng
      `;
      const [detailRows] = await db.execute(detailQuery, [
        prescRow.tgl_perawatan,
        prescRow.jam, 
        prescRow.tgl_perawatan,
        prescRow.jam
      ]);
      
      const obatList = detailRows.map(row => ({
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan || '-'
      }));
      
      if (obatList.length > 0) {
        medications.push({
          tanggal: this.formatDateOnly(prescRow.tgl_perawatan) + ' ' + prescRow.jam,
          no_resep: prescRow.no_resep,
          obat: obatList
        });
      }
    }
    
    return medications;
  }

  // Helper function to fetch medications request using 2-step approach
  static async fetchMedicationsRequest(noRawat, status) {
    // Step 1: Get list of unique prescriptions
    const prescRequestQuery = `
      SELECT DISTINCT no_resep, tgl_perawatan, jam
      FROM resep_obat 
      WHERE no_rawat = ? AND status = ?
      ORDER BY tgl_perawatan, jam
    `;
    const [prescRequestRows] = await db.execute(prescRequestQuery, [noRawat, status]);
    const medicationsRequest = [];
    
    // Step 2: For each prescription request, fetch detailed medications request
    for (const prescRequestRow of prescRequestRows) {
      // Skip if tgl_perawatan or jam is NULL
      if (!prescRequestRow.tgl_perawatan || !prescRequestRow.jam) {
        continue;
      }
      
      const detailRequestQuery = `
        SELECT dro.kode_brng, dro.jml, dro.aturan_pakai, ob.nama_brng
        FROM resep_dokter dro
        LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
        WHERE dro.no_resep = ?
        ORDER BY ob.nama_brng
      `;
      const [detailRequestRows] = await db.execute(detailRequestQuery, [prescRequestRow.no_resep]);
      
      const obatList = detailRequestRows.map(row => ({
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan_pakai || '-'
      }));
      
      if (obatList.length > 0) {
        medicationsRequest.push({
          tanggal: this.formatDateOnly(prescRequestRow.tgl_perawatan) + ' ' + prescRequestRow.jam,
          no_resep: prescRequestRow.no_resep,
          obat: obatList
        });
      }
    }
    
    return medicationsRequest;
  }

  // Helper function to fetch lab results request
  static async fetchLaboratoryRequest(noRawat, status) {
    const labRequestQuery = `
      SELECT pl.*, ppl.kd_jenis_prw, jpl.nm_perawatan  
      FROM permintaan_lab pl 
      LEFT JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder 
      LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
      WHERE pl.no_rawat = ? AND pl.status = ? 
      ORDER BY pl.tgl_permintaan, pl.jam_permintaan
    `;
    const [rows] = await db.execute(labRequestQuery, [noRawat, status]);
    
    const labsByDate = {};
    rows.forEach(row => {
      const dateKey = this.formatDateOnly(row.tgl_permintaan) + ' ' + row.jam_permintaan;
      if (!labsByDate[dateKey]) {
        labsByDate[dateKey] = [];
      }
      if (row.nm_perawatan) {
        labsByDate[dateKey].push({
          nama: row.nm_perawatan
        });
      }
    });
    
    return Object.entries(labsByDate).map(([tanggal, pemeriksaan]) => ({
      tanggal,
      pemeriksaan
    }));
  }

  // Helper function to fetch lab results
  static async fetchLaboratory(noRawat) {
    const labQuery = `
      SELECT pl.*, jp.nm_perawatan, dpl.nilai, dpl.nilai_rujukan, dpl.keterangan
      FROM periksa_lab pl 
      LEFT JOIN jns_perawatan_lab jp ON pl.kd_jenis_prw = jp.kd_jenis_prw 
      LEFT JOIN detail_periksa_lab dpl ON pl.no_rawat = dpl.no_rawat AND pl.kd_jenis_prw = dpl.kd_jenis_prw 
      WHERE pl.no_rawat = ? 
      ORDER BY pl.tgl_periksa, pl.jam
    `;
    const [rows] = await db.execute(labQuery, [noRawat]);
    
    const labsByDate = {};
    rows.forEach(row => {
      const dateKey = this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam;
      if (!labsByDate[dateKey]) {
        labsByDate[dateKey] = [];
      }
      if (row.nm_perawatan) {
        labsByDate[dateKey].push({
          nama: row.nm_perawatan,
          hasil: row.nilai || '',
          rujukan: row.nilai_rujukan || '',
          keterangan: row.keterangan || ''
        });
      }
    });

    return Object.entries(labsByDate).map(([tanggal, pemeriksaan]) => ({
      tanggal,
      pemeriksaan
    }));
  }

  // Helper function to fetch radiology results
  static async fetchRadiology(noRawat) {
    const radQuery = `
      SELECT pr.*, jp.nm_perawatan, hpr.hasil
      FROM periksa_radiologi pr 
      LEFT JOIN jns_perawatan_radiologi jp ON pr.kd_jenis_prw = jp.kd_jenis_prw 
      LEFT JOIN hasil_radiologi hpr ON pr.no_rawat = hpr.no_rawat AND pr.tgl_periksa = hpr.tgl_periksa 
      WHERE pr.no_rawat = ? 
      ORDER BY pr.tgl_periksa, pr.jam
    `;
    const [rows] = await db.execute(radQuery, [noRawat]);
    
    return rows.map(row => ({
      tanggal: this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam,
      pemeriksaan: row.nm_perawatan || '',
      hasil: row.hasil || '',
      kesan: row.hasil || ''
    }));
  }

  static parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  static normalizeOptions(options = {}) {
    return {
      limit: Math.min(this.parsePositiveInteger(options.limit, this.DEFAULT_LIMIT), 20),
      outpatientPage: this.parsePositiveInteger(options.outpatientPage, 1),
      inpatientPage: this.parsePositiveInteger(options.inpatientPage, 1),
      focusNoRawat: typeof options.focusNoRawat === 'string' && options.focusNoRawat.trim()
        ? options.focusNoRawat.trim()
        : null
    };
  }

  static async fetchVisitsPage(no_rm, statusLanjut, page, limit, focusNoRawat) {
    const offset = (page - 1) * limit;

    const [[countRow]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM reg_periksa
        WHERE no_rkm_medis = ? AND status_lanjut = ?
      `,
      [no_rm, statusLanjut]
    );

    const [rows] = await db.execute(
      `
        SELECT r.*, p.nm_poli, d.nm_dokter
        FROM reg_periksa r
        LEFT JOIN poliklinik p ON r.kd_poli = p.kd_poli
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ?
        ORDER BY
          CASE
            WHEN ? IS NOT NULL AND ? <> '' AND r.no_rawat = ? THEN 0
            ELSE 1
          END,
          r.tgl_registrasi DESC,
          r.jam_reg DESC
        LIMIT ? OFFSET ?
      `,
      [no_rm, statusLanjut, focusNoRawat, focusNoRawat, focusNoRawat, limit, offset]
    );

    const total = countRow?.total || 0;

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + rows.length < total
      }
    };
  }

  static async buildOutpatientVisit(visit) {
    const [
      examinations,
      procedures,
      medications,
      medicationsRequest,
      laboratory,
      laboratoryRequest,
      radiology
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ralan'),
      this.fetchProcedures(visit.no_rawat, 'ralan'),
      this.fetchMedications(visit.no_rawat, 'ralan'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ralan'),
      this.fetchLaboratory(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ralan'),
      this.fetchRadiology(visit.no_rawat)
    ]);

    return {
      no_rawat: visit.no_rawat,
      tanggal: this.formatDateOnly(visit.tgl_registrasi) + ' ' + visit.jam_reg,
      poliklinik: visit.nm_poli || '',
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ralan',
      examinations,
      procedures,
      medicationsRequest,
      medications,
      laboratoryRequest,
      laboratory,
      radiology
    };
  }

  static async buildInpatientVisit(visit, inpatientDetail) {
    const [
      examinations,
      procedures,
      medications,
      medicationsRequestRanap,
      medicationsRequestPulang,
      medicationsRequestIbs,
      laboratory,
      laboratoryRequest,
      radiology
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ranap'),
      this.fetchProcedures(visit.no_rawat, 'ranap'),
      this.fetchMedications(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'pulang'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ibs'),
      this.fetchLaboratory(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ranap'),
      this.fetchRadiology(visit.no_rawat)
    ]);

    return {
      no_rawat: visit.no_rawat,
      tanggal_masuk: inpatientDetail ? this.formatDateOnly(inpatientDetail.tgl_masuk) + ' ' + inpatientDetail.jam_masuk : '',
      tanggal_keluar: inpatientDetail?.tgl_keluar ? this.formatDateOnly(inpatientDetail.tgl_keluar) + ' ' + inpatientDetail.jam_keluar : '',
      ruangan: inpatientDetail?.nm_bangsal || inpatientDetail?.kd_kamar || '',
      kamar: inpatientDetail?.kd_kamar || '',
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ranap',
      cara_keluar: inpatientDetail?.stts_pulang || '',
      diagnosa_akhir: inpatientDetail?.diagnosa_akhir || '',
      examinations,
      procedures,
      medicationsRequest: medicationsRequestRanap,
      medicationsRequestRanap,
      medicationsRequestPulang,
      medicationsRequestIbs,
      medications,
      laboratoryRequest,
      laboratory,
      radiology
    };
  }

  static async getMedicalRecord(no_rm, options = {}) {
    try {
      console.log('Fetching medical record for no_rm:', no_rm);

      if (!no_rm) {
        throw new Error('no_rm parameter is required');
      }

      const {
        limit,
        outpatientPage,
        inpatientPage,
        focusNoRawat
      } = this.normalizeOptions(options);

      const [patientRows, latestVisitRows, outpatientPageResult, inpatientPageResult] = await Promise.all([
        db.execute(
          "SELECT * FROM pasien WHERE no_rkm_medis = ?",
          [no_rm]
        ),
        db.execute(
          `
            SELECT status_lanjut
            FROM reg_periksa
            WHERE no_rkm_medis = ?
            ORDER BY tgl_registrasi DESC, jam_reg DESC
            LIMIT 1
          `,
          [no_rm]
        ),
        this.fetchVisitsPage(no_rm, 'Ralan', outpatientPage, limit, focusNoRawat),
        this.fetchVisitsPage(no_rm, 'Ranap', inpatientPage, limit, focusNoRawat)
      ]);

      const patientList = patientRows[0];
      const latestVisits = latestVisitRows[0];

      if (patientList.length === 0) {
        throw new Error('Patient not found');
      }

      const patient = patientList[0];
      const outpatientVisits = outpatientPageResult.rows;
      const inpatientVisitRefs = inpatientPageResult.rows;

      let inpatientDetails = [];
      if (inpatientVisitRefs.length > 0) {
        const inpatientNoRawats = inpatientVisitRefs.map(row => row.no_rawat);
        const inpatientQuery = `
          SELECT ki.*, b.nm_bangsal
          FROM kamar_inap ki 
          LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
          LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
          WHERE ki.no_rawat IN (${inpatientNoRawats.map(() => '?').join(',')})
          ORDER BY ki.tgl_masuk DESC
        `;
        const [inpatientRows] = await db.execute(inpatientQuery, inpatientNoRawats);
        inpatientDetails = inpatientRows;
      }

      const inpatientDetailsMap = new Map(
        inpatientDetails.map(detail => [detail.no_rawat, detail])
      );

      const [finalOutpatientVisits, finalInpatientVisits] = await Promise.all([
        Promise.all(outpatientVisits.map((visit) => this.buildOutpatientVisit(visit))),
        Promise.all(
          inpatientVisitRefs.map((visit) =>
            this.buildInpatientVisit(visit, inpatientDetailsMap.get(visit.no_rawat))
          )
        )
      ]);

      const medicalRecordData = {
        patient: {
          nama: patient.nm_pasien || '',
          no_rm: patient.no_rkm_medis || '',
          tanggal_lahir: this.formatDateOnly(patient.tgl_lahir),
          jenis_kelamin: patient.jk === 'L' ? 'Laki-laki' : 'Perempuan',
          alamat: patient.alamat || '',
          telepon: patient.no_tlp || '',
          golongan_darah: patient.gol_darah || '',
          alergi: '', // Would need additional field in patient table
          status_lanjut: latestVisits[0]?.status_lanjut || 'Ralan'
        },
        outpatient_visits: finalOutpatientVisits,
        inpatient_visits: finalInpatientVisits
      };

      return {
        data: medicalRecordData,
        pagination: {
          outpatient: outpatientPageResult.pagination,
          inpatient: inpatientPageResult.pagination
        }
      };

    } catch (error) {
      console.error('Error in get medical record service:', error);
      throw error;
    }
  }
}

export default GetMedicalRecordService;
