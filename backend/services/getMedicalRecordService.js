import db from '../config/database.js';

class GetMedicalRecordService {
  static DEFAULT_LIMIT = 5;

  static getEnvValue(key) {
    const upper = String(key || '').trim();
    if (!upper) {
      return '';
    }

    const aliasKeys = {
      STOK_RESEP_RAJAL: ['STOK_RESEP_RALAN']
    };

    const aliases = Array.isArray(aliasKeys[upper]) ? aliasKeys[upper] : [];
    return (
      String(process.env[upper] || '').trim() ||
      String(process.env[upper.toLowerCase()] || '').trim() ||
      aliases
        .map((alias) => String(process.env[alias] || '').trim() || String(process.env[alias.toLowerCase()] || '').trim())
        .find(Boolean) ||
      ''
    );
  }

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

  static normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  static normalizePacsDate(dateStr) {
    if (!dateStr) {
      return '';
    }

    const rawValue = String(dateStr).trim();
    if (/^\d{8}$/.test(rawValue)) {
      return `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`;
    }

    return this.formatDateOnly(rawValue);
  }

  static async resolveMedicationStockBangsalCode(noRawat, status) {
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (normalizedStatus === 'ranap') {
      return this.getEnvValue('STOK_RESEP_RANAP');
    }

    if (normalizedStatus === 'pulang' || normalizedStatus === 'ibs' || normalizedStatus === 'ralan') {
      const [rows] = await db.execute(
        `
          SELECT kd_poli
          FROM reg_periksa
          WHERE no_rawat = ?
          LIMIT 1
        `,
        [noRawat]
      );

      const kdPoli = String(rows?.[0]?.kd_poli || '').trim();
      if (['B0054', 'IGDK', 'IGD01'].includes(kdPoli)) {
        return this.getEnvValue('STOK_RESEP_IGD');
      }

      return this.getEnvValue('STOK_RESEP_RAJAL');
    }

    return '';
  }

  static async getOrthancConfig() {
    const server = String(process.env.ORTHANC_SERVER || '').trim();
    const username = String(process.env.ORTHANC_USERNAME || 'orthanc').trim();
    const password = String(process.env.ORTHANC_PASSWORD || 'orthanc').trim();

    return {
      server,
      username,
      password
    };
  }

  static async requestOrthanc(pathname, init = {}) {
    const orthancConfig = await this.getOrthancConfig();
    if (!orthancConfig.server) {
      throw new Error('Konfigurasi server Orthanc belum tersedia');
    }

    const baseUrl = orthancConfig.server.replace(/\/+$/, '');
    const authToken = Buffer.from(`${orthancConfig.username}:${orthancConfig.password}`).toString('base64');
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Basic ${authToken}`,
        ...(init.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`Orthanc request failed with status ${response.status}`);
    }

    return response;
  }

  static async fetchRadiologyPacsSeries(noRawat) {
    const registrationQuery = `
      SELECT no_rkm_medis, tgl_registrasi
      FROM reg_periksa
      WHERE no_rawat = ?
      LIMIT 1
    `;
    const dateRangeQuery = `
      SELECT
        MIN(tgl_periksa) AS first_exam_date,
        MAX(tgl_periksa) AS last_exam_date
      FROM periksa_radiologi
      WHERE no_rawat = ?
    `;

    const [[registrationRows], [dateRangeRows]] = await Promise.all([
      db.execute(registrationQuery, [noRawat]),
      db.execute(dateRangeQuery, [noRawat])
    ]);

    const registration = registrationRows[0];
    const dateRange = dateRangeRows[0];
    const patientId = String(registration?.no_rkm_medis || '').trim();
    const studyStartDate = String(this.formatDateOnly(registration?.tgl_registrasi || '')).replace(/-/g, '');
    const studyEndDate = String(this.formatDateOnly(dateRange?.last_exam_date || '')).replace(/-/g, '');

    if (!patientId || !studyStartDate || !studyEndDate) {
      return [];
    }

    try {
      const findResponse = await this.requestOrthanc('/tools/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Level: 'Study',
          Expand: true,
          Query: {
            StudyDate: `${studyStartDate}-${studyEndDate}`,
            PatientID: patientId
          }
        })
      });

      const studies = await findResponse.json();
      if (!Array.isArray(studies) || studies.length === 0) {
        return [];
      }

      const seriesIds = studies.flatMap((study) => Array.isArray(study?.Series) ? study.Series : []);
      if (seriesIds.length === 0) {
        return [];
      }

      const seriesResults = await Promise.all(
        seriesIds.map(async (seriesId) => {
          try {
            const seriesResponse = await this.requestOrthanc(`/series/${seriesId}`);
            const seriesData = await seriesResponse.json();
            const seriesDate = this.normalizePacsDate(
              seriesData?.MainDicomTags?.SeriesDate || seriesData?.MainDicomTags?.StudyDate || ''
            );
            const description =
              seriesData?.MainDicomTags?.AcquisitionDeviceProcessingDescription ||
              seriesData?.MainDicomTags?.SeriesDescription ||
              '';
            const modality = String(
              seriesData?.MainDicomTags?.Modality ||
              seriesData?.RequestedTags?.Modality ||
              ''
            ).trim().toUpperCase();
            const instances = Array.isArray(seriesData?.Instances) ? seriesData.Instances : [];

            return {
              series_id: seriesId,
              series_date: seriesDate,
              description,
              modality,
              images: instances.map((instanceId) => ({
                instance_id: instanceId,
                series_id: seriesId
              }))
            };
          } catch (error) {
            console.error(`Error loading Orthanc series ${seriesId}:`, error);
            return null;
          }
        })
      );

      return seriesResults.filter(Boolean);
    } catch (error) {
      console.error(`Error fetching PACS radiology series for ${noRawat}:`, error);
      return [];
    }
  }

  static matchRadiologyPacsSeries(seriesList, examDate, examName) {
    const normalizedDate = this.formatDateOnly(examDate);
    const datedSeries = (seriesList || []).filter((series) => series?.series_date === normalizedDate);

    if (!datedSeries.length) {
      return [];
    }

    const normalizedExam = this.normalizeSearchText(examName);
    if (!normalizedExam) {
      return datedSeries;
    }

    const matchedSeries = datedSeries.filter((series) => {
      const normalizedDescription = this.normalizeSearchText(series?.description);
      return normalizedDescription && (
        normalizedDescription.includes(normalizedExam) ||
        normalizedExam.includes(normalizedDescription)
      );
    });

    return matchedSeries.length ? matchedSeries : datedSeries;
  }

  static serializeRadiologyPacsImage(image, series = {}) {
    return {
      ...image,
      series_date: series.series_date || '',
      description: series.description || '',
      modality: series.modality || ''
    };
  }

  static buildRadiologyPacsPayload(matchedSeries, options = {}) {
    const { limitCtToThumbnail = false } = options;
    const pacsModality = matchedSeries.find((series) => series?.modality)?.modality || '';
    const allImages = matchedSeries.flatMap((series) =>
      (series.images || []).map((image) => this.serializeRadiologyPacsImage(image, series))
    );
    const totalImages = allImages.length;
    const shouldLimitCtImages = limitCtToThumbnail && pacsModality === 'CT' && totalImages > 0;

    return {
      pacs_modality: pacsModality,
      pacs_total_images: totalImages,
      pacs_series: matchedSeries.map((series) => {
        const seriesImages = (series.images || []).map((image) => this.serializeRadiologyPacsImage(image, series));

        return {
          series_id: series.series_id || '',
          series_date: series.series_date || '',
          description: series.description || '',
          modality: series.modality || '',
          image_count: seriesImages.length,
          thumbnail_instance_id: seriesImages.length > 0 ? seriesImages[0].instance_id : '',
          images: shouldLimitCtImages ? seriesImages.slice(0, 1) : seriesImages
        };
      }),
      pacs_images: shouldLimitCtImages ? allImages.slice(0, 1) : allImages
    };
  }

  static async getRadiologyPacsImages(noRawat, examDate, examName) {
    const pacsSeries = await this.fetchRadiologyPacsSeries(noRawat);
    const matchedSeries = this.matchRadiologyPacsSeries(pacsSeries, examDate, examName);

    return this.buildRadiologyPacsPayload(matchedSeries);
  }

  static async getOrthancRenderedImage(instanceId, width = 500) {
    const normalizedWidth = Math.min(Math.max(parseInt(width, 10) || 500, 100), 2000);
    const response = await this.requestOrthanc(`/instances/${encodeURIComponent(instanceId)}/rendered/?width=${normalizedWidth}`);
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    return {
      contentType,
      buffer: Buffer.from(arrayBuffer)
    };
  }

  static async getOrthancPreviewImage(instanceId, width = 500) {
    try {
      const response = await this.requestOrthanc(`/instances/${encodeURIComponent(instanceId)}/preview`);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();

      return {
        contentType,
        buffer: Buffer.from(arrayBuffer)
      };
    } catch (error) {
      console.warn(`Orthanc preview unavailable for instance ${instanceId}, fallback to rendered:`, error.message);
      return this.getOrthancRenderedImage(instanceId, width);
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
      nip: row.nip || '',
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
    const statusRawat = type === 'ralan' ? 'Ralan' : 'Ranap';
    const proceduresQuery = `
      SELECT
        tindakan.tgl_perawatan,
        tindakan.jam_rawat,
        tindakan.kd_jenis_prw,
        tindakan.biaya_rawat,
        tindakan.record_type,
        tindakan.kd_dokter,
        tindakan.nip,
        tindakan.nama_pelaksana,
        jp.nm_perawatan
      FROM (
        SELECT
          tindakan.no_rawat,
          tindakan.kd_jenis_prw,
          tindakan.tgl_perawatan,
          tindakan.jam_rawat,
          tindakan.biaya_rawat,
          'dr' AS record_type,
          tindakan.kd_dokter,
          NULL AS nip,
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
          'pr' AS record_type,
          NULL AS kd_dokter,
          tindakan.nip,
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
          'drpr' AS record_type,
          tindakan.kd_dokter,
          tindakan.nip,
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
      tgl_perawatan: this.formatDateOnly(row.tgl_perawatan),
      jam_rawat: row.jam_rawat,
      kd_jenis_prw: row.kd_jenis_prw,
      nm_perawatan: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama: row.nm_perawatan || row.kd_jenis_prw || '-',
      nama_pelaksana: row.nama_pelaksana || '-',
      hasil: row.nama_pelaksana || '-',
      biaya_rawat: row.biaya_rawat || 0,
      record_type: row.record_type || 'dr',
      kd_dokter: row.kd_dokter || '',
      nip: row.nip || '',
      status_rawat: statusRawat
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
        kode_brng: row.kode_brng || '',
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
    const stockBangsalCode = await this.resolveMedicationStockBangsalCode(noRawat, status);

    // Step 1: Get list of unique prescriptions
    const prescRequestQuery = `
      SELECT DISTINCT no_resep, tgl_peresepan, jam_peresepan, kd_dokter
      FROM resep_obat 
      WHERE no_rawat = ? AND status = ?
      ORDER BY tgl_peresepan, jam_peresepan
    `;
    const [prescRequestRows] = await db.execute(prescRequestQuery, [noRawat, status]);
    const medicationsRequest = [];
    
    // Step 2: For each prescription request, fetch detailed medications request
    for (const prescRequestRow of prescRequestRows) {
      // Skip if tgl_peresepan or jam_peresepan is NULL
      if (!prescRequestRow.tgl_peresepan || !prescRequestRow.jam_peresepan) {
        continue;
      }
      
      const detailRequestQuery = `
        SELECT
          dro.kode_brng,
          dro.jml,
          dro.aturan_pakai,
          ob.nama_brng,
          ob.kode_sat AS satuan,
          COALESCE(SUM(gb.stok), 0) AS stok
        FROM resep_dokter dro
        LEFT JOIN databarang ob ON dro.kode_brng = ob.kode_brng
        LEFT JOIN gudangbarang gb ON gb.kode_brng = dro.kode_brng AND gb.kd_bangsal = ?
        WHERE dro.no_resep = ?
        GROUP BY dro.kode_brng, dro.jml, dro.aturan_pakai, ob.nama_brng, ob.kode_sat
        ORDER BY ob.nama_brng
      `;
      const compoundQuery = `
        SELECT
          rdr.no_racik,
          rdr.nama_racik,
          rdr.kd_racik,
          rdr.jml_dr,
          rdr.aturan_pakai,
          rdr.keterangan,
          mr.nm_racik
        FROM resep_dokter_racikan rdr
        LEFT JOIN metode_racik mr ON mr.kd_racik = rdr.kd_racik
        WHERE rdr.no_resep = ?
        ORDER BY rdr.no_racik ASC
      `;
      const [detailRequestRows, compoundRows] = await Promise.all([
        db.execute(detailRequestQuery, [stockBangsalCode, prescRequestRow.no_resep]).then(([rows]) => rows),
        db.execute(compoundQuery, [prescRequestRow.no_resep]).then(([rows]) => rows)
      ]);
      
      const obatList = detailRequestRows.map(row => ({
        kode_brng: row.kode_brng || '',
        nama: row.nama_brng || '-',
        jumlah: row.jml || '-',
        aturan_pakai: row.aturan_pakai || '-',
        satuan: row.satuan || '',
        stok: Number(row.stok) || 0
      }));

      const compounds = [];
      for (const compoundRow of compoundRows) {
        const [compoundDetailRows] = await db.execute(
          `
            SELECT
              rdrd.kode_brng,
              rdrd.kandungan,
              rdrd.jml,
              db.nama_brng,
              db.kode_sat AS satuan,
              COALESCE(SUM(gb.stok), 0) AS stok
            FROM resep_dokter_racikan_detail rdrd
            LEFT JOIN databarang db ON db.kode_brng = rdrd.kode_brng
            LEFT JOIN gudangbarang gb ON gb.kode_brng = rdrd.kode_brng AND gb.kd_bangsal = ?
            WHERE rdrd.no_resep = ? AND rdrd.no_racik = ?
            GROUP BY rdrd.kode_brng, rdrd.kandungan, rdrd.jml, db.nama_brng, db.kode_sat
            ORDER BY db.nama_brng ASC
          `,
          [stockBangsalCode, prescRequestRow.no_resep, compoundRow.no_racik]
        );

        compounds.push({
          no_racik: compoundRow.no_racik,
          nama_racik: compoundRow.nama_racik || '',
          kd_racik: compoundRow.kd_racik || '',
          nm_racik: compoundRow.nm_racik || '',
          jml_dr: compoundRow.jml_dr || '',
          aturan_pakai: compoundRow.aturan_pakai || '',
          keterangan: compoundRow.keterangan || '',
          details: compoundDetailRows.map((detailRow) => ({
            kode_brng: detailRow.kode_brng || '',
            nama_brng: detailRow.nama_brng || '-',
            kandungan: detailRow.kandungan || '',
            jml: detailRow.jml || '',
            satuan: detailRow.satuan || '',
            stok: Number(detailRow.stok) || 0
          }))
        });
      }
      
      if (obatList.length > 0 || compounds.length > 0) {
        medicationsRequest.push({
          tanggal: this.formatDateOnly(prescRequestRow.tgl_peresepan) + ' ' + prescRequestRow.jam_peresepan,
          no_resep: prescRequestRow.no_resep,
          kd_dokter: prescRequestRow.kd_dokter || '',
          obat: obatList,
          compounds
        });
      }
    }
    
    return medicationsRequest;
  }

  // Helper function to fetch lab results request
  static async fetchLaboratoryRequest(noRawat, status) {
    const labRequestQuery = `
      SELECT
        pl.noorder,
        pl.tgl_permintaan,
        pl.jam_permintaan,
        pl.dokter_perujuk,
        dpk.klinis,
        ppl.kd_jenis_prw,
        jpl.nm_perawatan,
        pdpl.id_template,
        tl.Pemeriksaan AS template_name,
        tl.satuan,
        tl.nilai_rujukan_ld,
        tl.nilai_rujukan_la,
        tl.nilai_rujukan_pd,
        tl.nilai_rujukan_pa
      FROM permintaan_lab pl 
      LEFT JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder 
      LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
      LEFT JOIN diagnosa_pasien_klinis dpk ON dpk.noorder = pl.noorder
      LEFT JOIN permintaan_detail_permintaan_lab pdpl
        ON pdpl.noorder = pl.noorder
        AND pdpl.kd_jenis_prw = ppl.kd_jenis_prw
      LEFT JOIN template_laboratorium tl ON tl.id_template = pdpl.id_template
      WHERE pl.no_rawat = ? AND pl.status = ? 
      ORDER BY pl.tgl_permintaan, pl.jam_permintaan, ppl.kd_jenis_prw, tl.Pemeriksaan
    `;
    const [rows] = await db.execute(labRequestQuery, [noRawat, status]);

    const requestsByOrder = new Map();

    rows.forEach((row) => {
      const requestKey = row.noorder || `${this.formatDateOnly(row.tgl_permintaan)} ${row.jam_permintaan}`;

      if (!requestsByOrder.has(requestKey)) {
        requestsByOrder.set(requestKey, {
          noorder: row.noorder || '',
          tanggal: this.formatDateOnly(row.tgl_permintaan) + ' ' + row.jam_permintaan,
          dokter_perujuk: row.dokter_perujuk || '',
          klinis: row.klinis || '',
          pemeriksaanMap: new Map()
        });
      }

      const requestEntry = requestsByOrder.get(requestKey);
      const examKey = row.kd_jenis_prw || row.nm_perawatan || '';

      if (row.nm_perawatan && !requestEntry.pemeriksaanMap.has(examKey)) {
        requestEntry.pemeriksaanMap.set(examKey, {
          kode: row.kd_jenis_prw || '',
          nama: row.nm_perawatan,
          templates: []
        });
      }

      if (row.id_template && requestEntry.pemeriksaanMap.has(examKey)) {
        const examEntry = requestEntry.pemeriksaanMap.get(examKey);
        const alreadyExists = examEntry.templates.some((template) => template.id_template === row.id_template);

        if (!alreadyExists) {
          examEntry.templates.push({
            id_template: row.id_template,
            nama: row.template_name || '',
            satuan: row.satuan || '',
            nilai_rujukan_ld: row.nilai_rujukan_ld || '',
            nilai_rujukan_la: row.nilai_rujukan_la || '',
            nilai_rujukan_pd: row.nilai_rujukan_pd || '',
            nilai_rujukan_pa: row.nilai_rujukan_pa || ''
          });
        }
      }
    });

    return Array.from(requestsByOrder.values()).map((requestEntry) => ({
      noorder: requestEntry.noorder,
      tanggal: requestEntry.tanggal,
      dokter_perujuk: requestEntry.dokter_perujuk,
      klinis: requestEntry.klinis,
      pemeriksaan: Array.from(requestEntry.pemeriksaanMap.values())
    }));
  }

  // Helper function to fetch lab results
  static async fetchLaboratory(noRawat, status = null) {
    const labQuery = `
      SELECT pl.*, jp.nm_perawatan, dpl.nilai, dpl.nilai_rujukan, dpl.keterangan, tl.Pemeriksaan AS pemeriksaan
      FROM periksa_lab pl 
      LEFT JOIN jns_perawatan_lab jp ON pl.kd_jenis_prw = jp.kd_jenis_prw 
      LEFT JOIN detail_periksa_lab dpl
        ON pl.no_rawat = dpl.no_rawat
        AND pl.kd_jenis_prw = dpl.kd_jenis_prw
        AND pl.tgl_periksa = dpl.tgl_periksa
        AND pl.jam = dpl.jam
      LEFT JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
      WHERE pl.no_rawat = ?
        AND (? IS NULL OR LOWER(pl.status) = LOWER(?))
      ORDER BY pl.tgl_periksa, pl.jam, tl.Pemeriksaan
    `;
    const [rows] = await db.execute(labQuery, [noRawat, status, status]);
    
    const labsByDate = {};
    rows.forEach(row => {
      const dateKey = this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam;
      if (!labsByDate[dateKey]) {
        labsByDate[dateKey] = [];
      }
      if (row.nm_perawatan) {
        labsByDate[dateKey].push({
          nama: row.nm_perawatan,
          pemeriksaan: row.pemeriksaan || '',
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
  static async fetchRadiology(noRawat, status = null, options = {}) {
    const includePacs = options.includePacs === true;
    const radQuery = `
      SELECT pr.*, jp.nm_perawatan, hpr.hasil
      FROM periksa_radiologi pr 
      LEFT JOIN jns_perawatan_radiologi jp ON pr.kd_jenis_prw = jp.kd_jenis_prw 
      LEFT JOIN hasil_radiologi hpr ON pr.no_rawat = hpr.no_rawat AND pr.tgl_periksa = hpr.tgl_periksa 
      WHERE pr.no_rawat = ?
        AND (? IS NULL OR LOWER(pr.status) = LOWER(?))
      ORDER BY pr.tgl_periksa, pr.jam
    `;
    const [[rows], pacsSeries] = await Promise.all([
      db.execute(radQuery, [noRawat, status, status]),
      includePacs ? this.fetchRadiologyPacsSeries(noRawat) : Promise.resolve([])
    ]);

    return rows.map(row => {
      const matchedSeries = this.matchRadiologyPacsSeries(
        pacsSeries,
        row.tgl_periksa,
        row.nm_perawatan
      );
      const pacsPayload = this.buildRadiologyPacsPayload(matchedSeries, {
        limitCtToThumbnail: true
      });

      return {
        no_rawat: row.no_rawat || '',
        tanggal: this.formatDateOnly(row.tgl_periksa) + ' ' + row.jam,
        tgl_periksa: this.formatDateOnly(row.tgl_periksa),
        pemeriksaan: row.nm_perawatan || '',
        hasil: row.hasil || '',
        kesan: row.hasil || '',
        ...(includePacs ? pacsPayload : {})
      };
    });
  }

  static async fetchOperationReports(noRawat) {
    const operationQuery = `
      SELECT
        lo.id,
        lo.no_rawat,
        lo.kd_dokter,
        lo.tanggal_op,
        lo.hasil_op,
        lo.pre_op,
        lo.post_op,
        lo.implan,
        lo.kirim_pa,
        lo.nm_op,
        DATE_FORMAT(lo.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM mlite_lap_op lo
      WHERE lo.no_rawat = ?
        AND lo.deleted_at IS NULL
      ORDER BY lo.created_at DESC, lo.id DESC
    `;
    const [rows] = await db.execute(operationQuery, [noRawat]);

    return rows.map((row) => ({
      id: row.id,
      no_rawat: row.no_rawat,
      kd_dokter: row.kd_dokter || '',
      tanggal_op: row.tanggal_op || '',
      hasil_op: row.hasil_op || '',
      pre_op: row.pre_op || '',
      post_op: row.post_op || '',
      implan: row.implan || '',
      kirim_pa: row.kirim_pa || '',
      nm_op: row.nm_op || '',
      created_at: row.created_at || ''
    }));
  }

  static async fetchRadiologyRequest(noRawat, status) {
    const radiologyRequestQuery = `
      SELECT
        pr.noorder,
        pr.tgl_permintaan,
        pr.jam_permintaan,
        pr.dokter_perujuk,
        dpk.klinis,
        ppr.kd_jenis_prw,
        jpr.nm_perawatan
      FROM permintaan_radiologi pr
      LEFT JOIN diagnosa_pasien_klinis dpk ON dpk.noorder = pr.noorder
      LEFT JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
      LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
      WHERE pr.no_rawat = ? AND pr.status = ?
      ORDER BY pr.tgl_permintaan, pr.jam_permintaan, jpr.nm_perawatan
    `;
    const [rows] = await db.execute(radiologyRequestQuery, [noRawat, status]);

    const requestsByOrder = new Map();

    rows.forEach((row) => {
      const requestKey = row.noorder || `${this.formatDateOnly(row.tgl_permintaan)} ${row.jam_permintaan}`;

      if (!requestsByOrder.has(requestKey)) {
        requestsByOrder.set(requestKey, {
          noorder: row.noorder || '',
          tanggal: this.formatDateOnly(row.tgl_permintaan) + ' ' + row.jam_permintaan,
          dokter_perujuk: row.dokter_perujuk || '',
          klinis: row.klinis || '',
          pemeriksaan: []
        });
      }

      const requestEntry = requestsByOrder.get(requestKey);

      if (row.nm_perawatan) {
        const alreadyExists = requestEntry.pemeriksaan.some((item) => item.kode === row.kd_jenis_prw);

        if (!alreadyExists) {
          requestEntry.pemeriksaan.push({
            kode: row.kd_jenis_prw || '',
            nama: row.nm_perawatan
          });
        }
      }
    });

    return Array.from(requestsByOrder.values());
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
      includeOutpatient: options.includeOutpatient !== false,
      includeInpatient: options.includeInpatient !== false,
      includeVisitDetails: options.includeVisitDetails !== false,
      includeFocusedExaminations: options.includeFocusedExaminations === true,
      includeFocusedProcedures: options.includeFocusedProcedures === true,
      includeFocusedMedications: options.includeFocusedMedications === true,
      includeFocusedLaboratory: options.includeFocusedLaboratory === true,
      includeFocusedRadiology: options.includeFocusedRadiology === true,
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

  static async fetchInpatientDetailsByNoRawats(noRawats = []) {
    if (!Array.isArray(noRawats) || noRawats.length === 0) {
      return [];
    }

    const inpatientQuery = `
      SELECT ki.*, b.nm_bangsal
      FROM kamar_inap ki
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE ki.no_rawat IN (${noRawats.map(() => '?').join(',')})
      ORDER BY ki.tgl_masuk DESC
    `;
    const [inpatientRows] = await db.execute(inpatientQuery, noRawats);
    return inpatientRows;
  }

  static buildOutpatientVisitSummary(visit) {
    return {
      no_rawat: visit.no_rawat,
      tanggal: this.formatDateOnly(visit.tgl_registrasi) + ' ' + visit.jam_reg,
      poliklinik: visit.nm_poli || '',
      dokter: visit.nm_dokter || '',
      status: visit.stts || '',
      status_lanjut: visit.status_lanjut || 'Ralan',
      details_loaded: false
    };
  }

  static buildInpatientVisitSummary(visit, inpatientDetail) {
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
      details_loaded: false
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
      radiology,
      radiologyRequest
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ralan'),
      this.fetchProcedures(visit.no_rawat, 'ralan'),
      this.fetchMedications(visit.no_rawat, 'ralan'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ralan'),
      this.fetchLaboratory(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ralan'),
      this.fetchRadiology(visit.no_rawat),
      this.fetchRadiologyRequest(visit.no_rawat, 'ralan')
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
      radiology,
      radiologyRequest,
      details_loaded: true
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
      radiology,
      radiologyRequest,
      operationReports
    ] = await Promise.all([
      this.fetchExaminations(visit.no_rawat, 'ranap'),
      this.fetchProcedures(visit.no_rawat, 'ranap'),
      this.fetchMedications(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ranap'),
      this.fetchMedicationsRequest(visit.no_rawat, 'pulang'),
      this.fetchMedicationsRequest(visit.no_rawat, 'ibs'),
      this.fetchLaboratory(visit.no_rawat),
      this.fetchLaboratoryRequest(visit.no_rawat, 'ranap'),
      this.fetchRadiology(visit.no_rawat),
      this.fetchRadiologyRequest(visit.no_rawat, 'ranap'),
      this.fetchOperationReports(visit.no_rawat)
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
      radiology,
      radiologyRequest,
      operationReports,
      details_loaded: true
    };
  }

  static async getVisitDetails(noRawat) {
    const [visitRows] = await db.execute(
      `
        SELECT r.*, p.nm_poli, d.nm_dokter
        FROM reg_periksa r
        LEFT JOIN poliklinik p ON r.kd_poli = p.kd_poli
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        WHERE r.no_rawat = ?
        LIMIT 1
      `,
      [noRawat]
    );

    const visit = visitRows[0];
    if (!visit) {
      throw new Error('Visit not found');
    }

    if (String(visit.status_lanjut || '').trim() === 'Ranap') {
      const inpatientDetails = await this.fetchInpatientDetailsByNoRawats([noRawat]);
      const inpatientDetail = inpatientDetails.find((detail) => detail.no_rawat === noRawat);
      return this.buildInpatientVisit(visit, inpatientDetail);
    }

    return this.buildOutpatientVisit(visit);
  }

  static async fetchExaminationsPage(no_rm, statusLanjut, page, limit, focusNoRawat) {
    const table = statusLanjut === 'Ranap' ? 'pemeriksaan_ranap' : 'pemeriksaan_ralan';
    const type = statusLanjut === 'Ranap' ? 'ranap' : 'ralan';
    const offset = (page - 1) * limit;
    const focusFilter = focusNoRawat ? ' AND r.no_rawat = ? ' : '';
    const params = focusNoRawat ? [no_rm, statusLanjut, focusNoRawat] : [no_rm, statusLanjut];

    const [[countRow]] = await db.execute(
      `
        SELECT COUNT(*) AS total
        FROM ${table} p1
        INNER JOIN reg_periksa r ON r.no_rawat = p1.no_rawat
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ? ${focusFilter}
      `,
      params
    );

    const [rows] = await db.execute(
      `
        SELECT
          p1.*,
          p2.nama,
          r.no_rawat,
          r.status_lanjut
        FROM ${table} p1
        INNER JOIN reg_periksa r ON r.no_rawat = p1.no_rawat
        LEFT JOIN pegawai p2 ON p2.nik = p1.nip
        WHERE r.no_rkm_medis = ? AND r.status_lanjut = ? ${focusFilter}
        ORDER BY p1.tgl_perawatan DESC, p1.jam_rawat DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      rows: rows.map((exam, examIndex) => {
        const examDate = String(exam.tgl_perawatan || exam.tanggal || '').trim();
        const examTime = String(exam.jam_rawat || '00:00').trim() || '00:00';
        const parsedDate = examDate
          ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
          : 0;

        return {
          key: `${type}-${exam.no_rawat}-${examDate}-${examTime}-${examIndex}`,
          visit: { no_rawat: exam.no_rawat, status_lanjut: statusLanjut },
          exam,
          rawatType: statusLanjut,
          timestamp: Number.isNaN(parsedDate) ? 0 : parsedDate
        };
      }),
      pagination: {
        page,
        limit,
        total: countRow?.total || 0,
        hasMore: offset + rows.length < (countRow?.total || 0)
      }
    };
  }

  static async getExaminationHistory(no_rm, options = {}) {
    const { limit, outpatientPage, inpatientPage, includeOutpatient, includeInpatient, focusNoRawat } = this.normalizeOptions(options);
    const [outpatientResult, inpatientResult] = await Promise.all([
      includeOutpatient
        ? this.fetchExaminationsPage(no_rm, 'Ralan', outpatientPage, limit, focusNoRawat)
        : Promise.resolve(null),
      includeInpatient
        ? this.fetchExaminationsPage(no_rm, 'Ranap', inpatientPage, limit, focusNoRawat)
        : Promise.resolve(null)
    ]);

    return {
      data: {
        outpatient: outpatientResult?.rows || [],
        inpatient: inpatientResult?.rows || []
      },
      pagination: {
        ...(outpatientResult?.pagination ? { outpatient: outpatientResult.pagination } : {}),
        ...(inpatientResult?.pagination ? { inpatient: inpatientResult.pagination } : {})
      }
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
        includeOutpatient,
        includeInpatient,
        includeVisitDetails,
        includeFocusedExaminations,
        includeFocusedProcedures,
        includeFocusedMedications,
        includeFocusedLaboratory,
        includeFocusedRadiology,
        focusNoRawat
      } = this.normalizeOptions(options);

      const [
        patientRows,
        patientAllergyRows,
        patientPrbRows,
        patientPrbProgramRows,
        latestVisitRows,
        outpatientPageResult,
        inpatientPageResult,
        focusedRalanExaminations,
        focusedRanapExaminations,
        focusedRalanProcedures,
        focusedRanapProcedures,
        focusedRalanMedicationRequests,
        focusedRanapMedicationRequests,
        focusedPulangMedicationRequests,
        focusedIbsMedicationRequests,
        focusedRalanMedications,
        focusedRanapMedications,
        focusedRalanLaboratoryRequests,
        focusedRanapLaboratoryRequests,
        focusedRalanLaboratory,
        focusedRanapLaboratory,
        focusedRalanRadiologyRequests,
        focusedRanapRadiologyRequests,
        focusedRalanRadiology,
        focusedRanapRadiology,
        focusedOperationReports
      ] = await Promise.all([
        db.execute(
          "SELECT * FROM pasien WHERE no_rkm_medis = ?",
          [no_rm]
        ),
        db.execute(
          `
            SELECT GROUP_CONCAT(
              DISTINCT TRIM(
                CASE
                  WHEN ma.kategori = 'Obat' THEN COALESCE(db.nama_brng, '')
                  ELSE COALESCE(masterAlergi.nama, '')
                END
              )
              ORDER BY
                CASE
                  WHEN ma.kategori = 'Obat' THEN COALESCE(db.nama_brng, '')
                  ELSE COALESCE(masterAlergi.nama, '')
                END ASC
              SEPARATOR ', '
            ) AS alergi
            FROM mlite_alergi ma
            LEFT JOIN databarang db
              ON ma.kategori = 'Obat'
              AND ma.kode_brng = db.kode_brng
            LEFT JOIN master_alergi masterAlergi
              ON ma.kategori <> 'Obat'
              AND ma.kode_brng = masterAlergi.id
            WHERE ma.no_rkm_medis = ?
              AND COALESCE(ma.status, '1') = '1'
          `,
          [no_rm]
        ),
        focusNoRawat
          ? db.execute(
              `
                SELECT bp.prb
                FROM bpjs_prb bp
                INNER JOIN bridging_sep bs ON bs.no_sep = bp.no_sep
                WHERE bs.no_rawat = ?
                LIMIT 1
              `,
              [focusNoRawat]
            )
          : Promise.resolve([[]]),
        db.execute(
          `
            SELECT pp.nm_program
            FROM pasien p
            LEFT JOIN peserta_prb pp ON pp.no_peserta = p.no_peserta
            WHERE p.no_rkm_medis = ?
            LIMIT 1
          `,
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
        includeOutpatient
          ? this.fetchVisitsPage(no_rm, 'Ralan', outpatientPage, limit, focusNoRawat)
          : Promise.resolve(null),
        includeInpatient
          ? this.fetchVisitsPage(no_rm, 'Ranap', inpatientPage, limit, focusNoRawat)
          : Promise.resolve(null),
        focusNoRawat && includeFocusedExaminations ? this.fetchExaminations(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedExaminations ? this.fetchExaminations(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedProcedures ? this.fetchProcedures(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedProcedures ? this.fetchProcedures(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationsRequest(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationsRequest(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationsRequest(focusNoRawat, 'pulang') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedicationsRequest(focusNoRawat, 'ibs') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedications(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedMedications ? this.fetchMedications(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryRequest(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratoryRequest(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratory(focusNoRawat, 'Ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedLaboratory ? this.fetchLaboratory(focusNoRawat, 'Ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiologyRequest(focusNoRawat, 'ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiologyRequest(focusNoRawat, 'ranap') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiology(focusNoRawat, 'Ralan') : Promise.resolve([]),
        focusNoRawat && includeFocusedRadiology ? this.fetchRadiology(focusNoRawat, 'Ranap') : Promise.resolve([]),
        focusNoRawat ? this.fetchOperationReports(focusNoRawat) : Promise.resolve([])
      ]);

      const patientList = patientRows[0];
      const patientAllergies = patientAllergyRows[0];
      const patientPrb = patientPrbRows[0];
      const patientPrbProgram = patientPrbProgramRows[0];
      const latestVisits = latestVisitRows[0];

      if (patientList.length === 0) {
        throw new Error('Patient not found');
      }

      const patient = patientList[0];
      const allergySummary = String(patientAllergies?.[0]?.alergi || '').trim();
      const prbLabel = String(patientPrb?.[0]?.prb || '').trim();
      const prbProgram = String(patientPrbProgram?.[0]?.nm_program || '').trim();
      const outpatientVisits = outpatientPageResult?.rows || [];
      const inpatientVisitRefs = inpatientPageResult?.rows || [];

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
        includeVisitDetails
          ? Promise.all(outpatientVisits.map((visit) => this.buildOutpatientVisit(visit)))
          : Promise.resolve(outpatientVisits.map((visit) => this.buildOutpatientVisitSummary(visit))),
        includeVisitDetails
          ? Promise.all(
              inpatientVisitRefs.map((visit) =>
                this.buildInpatientVisit(visit, inpatientDetailsMap.get(visit.no_rawat))
              )
            )
          : Promise.resolve(
              inpatientVisitRefs.map((visit) =>
                this.buildInpatientVisitSummary(visit, inpatientDetailsMap.get(visit.no_rawat))
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
          alergi: allergySummary,
          prb: prbLabel,
          prb_program: prbProgram,
          status_lanjut: latestVisits[0]?.status_lanjut || 'Ralan'
        },
        outpatient_visits: finalOutpatientVisits,
        inpatient_visits: finalInpatientVisits,
        ...(includeFocusedExaminations ? {
          focused_examinations: {
            ralan: focusedRalanExaminations,
            ranap: focusedRanapExaminations
          }
        } : {}),
        ...(includeFocusedProcedures ? {
          focused_procedures: {
            ralan: focusedRalanProcedures,
            ranap: focusedRanapProcedures
          }
        } : {}),
        ...(includeFocusedMedications ? {
          focused_medications_request: {
            ralan: focusedRalanMedicationRequests,
            ranap: focusedRanapMedicationRequests,
            pulang: focusedPulangMedicationRequests,
            ibs: focusedIbsMedicationRequests
          },
          focused_medications: {
            ralan: focusedRalanMedications,
            ranap: focusedRanapMedications
          }
        } : {}),
        ...(includeFocusedLaboratory ? {
          focused_laboratory_request: {
            ralan: focusedRalanLaboratoryRequests,
            ranap: focusedRanapLaboratoryRequests
          },
          focused_laboratory: {
            ralan: focusedRalanLaboratory,
            ranap: focusedRanapLaboratory
          }
        } : {}),
        ...(includeFocusedRadiology ? {
          focused_radiology_request: {
            ralan: focusedRalanRadiologyRequests,
            ranap: focusedRanapRadiologyRequests
          },
          focused_radiology: {
            ralan: focusedRalanRadiology,
            ranap: focusedRanapRadiology
          }
        } : {}),
        focused_operation_reports: focusedOperationReports
      };

      return {
        data: medicalRecordData,
        pagination: {
          ...(outpatientPageResult?.pagination ? { outpatient: outpatientPageResult.pagination } : {}),
          ...(inpatientPageResult?.pagination ? { inpatient: inpatientPageResult.pagination } : {})
        }
      };

    } catch (error) {
      console.error('Error in get medical record service:', error);
      throw error;
    }
  }
}

export default GetMedicalRecordService;
