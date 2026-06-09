import db from '../config/database.js';

class BookingRegistrasiService {
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

  static async getDoctors() {
    try {
      const query = `
        SELECT kd_dokter, nm_dokter
        FROM dokter 
        WHERE status = '1'
        ORDER BY nm_dokter ASC
      `;
      
      const [rows] = await db.execute(query);
      return { success: true, doctors: rows };
    } catch (error) {
      console.error('Error fetching doctors:', error);
      return { success: false, error: error.message };
    }
  }

  static getSessionCondition(sessionFilter) {
    const normalizedSession = String(sessionFilter || '').trim().toLowerCase();

    if (normalizedSession !== 'pagi' && normalizedSession !== 'sore') {
      return null;
    }

    return {
      condition: "LOWER(COALESCE(pk.nm_poli, '')) LIKE ?",
      param: `%${normalizedSession}%`
    };
  }

  static async getAll({ startDate, endDate, status, kd_dokter, sessionFilter, page = 1, itemsPerPage = 10 }) {
    try {
      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      
      let baseQuery = `
        SELECT 
          br.tanggal_booking,
          br.jam_booking,
          br.no_rkm_medis,
          br.tanggal_periksa,
          br.kd_dokter,
          br.kd_poli,
          br.no_reg,
          br.kd_pj,
          br.limit_reg,
          br.waktu_kunjungan,
          br.status,
          p.nm_pasien,
          p.alamat,
          p.no_tlp,
          p.email,
          d.nm_dokter,
          pk.nm_poli,
          pj.png_jawab
        FROM booking_registrasi br
        LEFT JOIN pasien p ON br.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON br.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pk ON br.kd_poli = pk.kd_poli
        LEFT JOIN penjab pj ON br.kd_pj = pj.kd_pj
      `;
      
      const queryParams = [];
      const conditions = [];
      
      // Filter by examination date range
      if (startDate && endDate) {
        conditions.push('br.tanggal_periksa BETWEEN ? AND ?');
        queryParams.push(startDate, endDate);
      }
      
      // Filter by status
      if (status && status !== 'all') {
        conditions.push('br.status = ?');
        queryParams.push(status);
      }
      
      // Filter by doctor
      if (kd_dokter && kd_dokter !== 'all') {
        conditions.push('br.kd_dokter = ?');
        queryParams.push(kd_dokter);
      }

      const baseConditions = [...conditions];
      const baseQueryParams = [...queryParams];

      const sessionCondition = this.getSessionCondition(sessionFilter);
      if (sessionCondition) {
        conditions.push(sessionCondition.condition);
        queryParams.push(sessionCondition.param);
      }
      
      const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
      const baseWhereClause = baseConditions.length > 0 ? ' WHERE ' + baseConditions.join(' AND ') : '';
      const countBaseQuery = `
        FROM booking_registrasi br
        LEFT JOIN pasien p ON br.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON br.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pk ON br.kd_poli = pk.kd_poli
        LEFT JOIN penjab pj ON br.kd_pj = pj.kd_pj
      `;
      
      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        ${countBaseQuery}
        ${whereClause}
      `;

      const tabCountQuery = `
        SELECT COUNT(*) as total
        ${countBaseQuery}
        %WHERE_CLAUSE%
      `;
      
      const dataQuery = baseQuery + whereClause + ` ORDER BY br.tanggal_periksa DESC, br.jam_booking ASC ${limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`}`;
      
      // Execute count query
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0]?.total || 0;

      const [pagiCountResult, soreCountResult] = await Promise.all([
        db.execute(
          tabCountQuery.replace(
            '%WHERE_CLAUSE%',
            `${baseWhereClause}${baseWhereClause ? ' AND ' : ' WHERE '}LOWER(COALESCE(pk.nm_poli, '')) LIKE ?`
          ),
          [...baseQueryParams, '%pagi%']
        ),
        db.execute(
          tabCountQuery.replace(
            '%WHERE_CLAUSE%',
            `${baseWhereClause}${baseWhereClause ? ' AND ' : ' WHERE '}LOWER(COALESCE(pk.nm_poli, '')) LIKE ?`
          ),
          [...baseQueryParams, '%sore%']
        )
      ]);

      const tabCounts = {
        pagi: pagiCountResult[0]?.[0]?.total || 0,
        sore: soreCountResult[0]?.[0]?.total || 0
      };
      
      // Execute data query with pagination
      const queryParams2 = queryParams;
      const [rows] = await db.execute(dataQuery, queryParams2);
      
      const bookings = rows.map(row => ({
        ...row,
        tanggal_booking: this.formatDateOnly(row.tanggal_booking),
        tanggal_periksa: this.formatDateOnly(row.tanggal_periksa)
      }));
      
      return {
        success: true,
        bookings,
        total,
        tabCounts,
        limit,
        offset,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error fetching booking registrations:', error);
      return { success: false, error: error.message };
    }
  }

  static async getById(no_rkm_medis, tanggal_periksa) {
    try {
      if (!no_rkm_medis || !tanggal_periksa) {
        return { success: false, error: 'no_rkm_medis and tanggal_periksa are required' };
      }
      
      const query = `
        SELECT 
          br.tanggal_booking,
          br.jam_booking,
          br.no_rkm_medis,
          br.tanggal_periksa,
          br.kd_dokter,
          br.kd_poli,
          br.no_reg,
          br.kd_pj,
          br.limit_reg,
          br.waktu_kunjungan,
          br.status,
          p.nm_pasien,
          p.alamat,
          p.no_tlp,
          p.email,
          d.nm_dokter,
          pk.nm_poli,
          pj.png_jawab
        FROM booking_registrasi br
        LEFT JOIN pasien p ON br.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON br.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pk ON br.kd_poli = pk.kd_poli
        LEFT JOIN penjab pj ON br.kd_pj = pj.kd_pj
        WHERE br.no_rkm_medis = ? AND br.tanggal_periksa = ?
      `;
      
      const [rows] = await db.execute(query, [no_rkm_medis, tanggal_periksa]);
      let booking = rows[0] || null;
      
      if (booking) {
        booking = {
          ...booking,
          tanggal_booking: this.formatDateOnly(booking.tanggal_booking),
          tanggal_periksa: this.formatDateOnly(booking.tanggal_periksa)
        };
      }
      
      return { success: true, booking };
    } catch (error) {
      console.error('Error fetching booking by ID:', error);
      return { success: false, error: error.message };
    }
  }

  static async create(data) {
    try {
      if (!data) {
        return { success: false, error: 'booking data is required' };
      }
      
      const createQuery = `
        INSERT INTO booking_registrasi (
          tanggal_booking, jam_booking, no_rkm_medis, tanggal_periksa, 
          kd_dokter, kd_poli, no_reg, kd_pj, limit_reg, waktu_kunjungan, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const createParams = [
        data.tanggal_booking || new Date().toISOString().slice(0, 10),
        data.jam_booking,
        data.no_rkm_medis,
        data.tanggal_periksa,
        data.kd_dokter,
        data.kd_poli,
        data.no_reg,
        data.kd_pj,
        data.limit_reg || 1,
        data.waktu_kunjungan,
        data.status || 'Belum'
      ];

      await db.execute(createQuery, createParams);

      // Get the created booking
      const createdBookingQuery = `
        SELECT 
          br.tanggal_booking,
          br.jam_booking,
          br.no_rkm_medis,
          br.tanggal_periksa,
          br.kd_dokter,
          br.kd_poli,
          br.no_reg,
          br.kd_pj,
          br.limit_reg,
          br.waktu_kunjungan,
          br.status,
          p.nm_pasien,
          p.alamat,
          p.no_tlp,
          p.email,
          d.nm_dokter,
          pk.nm_poli,
          pj.png_jawab
        FROM booking_registrasi br
        LEFT JOIN pasien p ON br.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON br.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pk ON br.kd_poli = pk.kd_poli
        LEFT JOIN penjab pj ON br.kd_pj = pj.kd_pj
        WHERE br.no_rkm_medis = ? AND br.tanggal_periksa = ?
      `;
      
      const [rows] = await db.execute(createdBookingQuery, [data.no_rkm_medis, data.tanggal_periksa]);
      let booking = rows[0];
      
      if (booking) {
        booking = {
          ...booking,
          tanggal_booking: this.formatDateOnly(booking.tanggal_booking),
          tanggal_periksa: this.formatDateOnly(booking.tanggal_periksa)
        };
      }
      
      return { success: true, booking };
    } catch (error) {
      console.error('Error creating booking:', error);
      return { success: false, error: error.message };
    }
  }

  static async update(no_rkm_medis, tanggal_periksa, data) {
    try {
      if (!no_rkm_medis || !tanggal_periksa || !data) {
        return { success: false, error: 'no_rkm_medis, tanggal_periksa and data are required' };
      }
      
      const setClause = [];
      const updateParams = [];

      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'no_rkm_medis' && key !== 'tanggal_periksa' && value !== undefined) {
          setClause.push(`${key} = ?`);
          updateParams.push(value);
        }
      });

      if (setClause.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }

      updateParams.push(no_rkm_medis, tanggal_periksa);

      const updateQuery = `
        UPDATE booking_registrasi 
        SET ${setClause.join(', ')}
        WHERE no_rkm_medis = ? AND tanggal_periksa = ?
      `;

      await db.execute(updateQuery, updateParams);

      // Get the updated booking
      const updatedBookingQuery = `
        SELECT 
          br.tanggal_booking,
          br.jam_booking,
          br.no_rkm_medis,
          br.tanggal_periksa,
          br.kd_dokter,
          br.kd_poli,
          br.no_reg,
          br.kd_pj,
          br.limit_reg,
          br.waktu_kunjungan,
          br.status,
          p.nm_pasien,
          p.alamat,
          p.no_tlp,
          p.email,
          d.nm_dokter,
          pk.nm_poli,
          pj.png_jawab
        FROM booking_registrasi br
        LEFT JOIN pasien p ON br.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON br.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pk ON br.kd_poli = pk.kd_poli
        LEFT JOIN penjab pj ON br.kd_pj = pj.kd_pj
        WHERE br.no_rkm_medis = ? AND br.tanggal_periksa = ?
      `;
      
      const [rows] = await db.execute(updatedBookingQuery, [no_rkm_medis, tanggal_periksa]);
      let booking = rows[0];
      
      if (booking) {
        booking = {
          ...booking,
          tanggal_booking: this.formatDateOnly(booking.tanggal_booking),
          tanggal_periksa: this.formatDateOnly(booking.tanggal_periksa)
        };
      }
      
      return { success: true, booking };
    } catch (error) {
      console.error('Error updating booking:', error);
      return { success: false, error: error.message };
    }
  }
}

export { BookingRegistrasiService };
