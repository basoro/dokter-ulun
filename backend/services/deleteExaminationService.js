import db from '../config/database.js';

class DeleteExaminationService {
  static async deleteExamination(no_rawat, status_rawat, tgl_perawatan, jam_rawat) {
    try {
      console.log('Delete examination request:', { no_rawat, status_rawat, tgl_perawatan, jam_rawat });

      if (!no_rawat || !status_rawat || !tgl_perawatan || !jam_rawat) {
        throw new Error('Missing required parameters: no_rawat, status_rawat, tgl_perawatan, jam_rawat');
      }

      let result;
      let table;
      
      if (status_rawat === 'Ralan') {
        // Delete from pemeriksaan_ralan table
        table = 'pemeriksaan_ralan';
        [result] = await db.execute(`
          DELETE FROM pemeriksaan_ralan 
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        `, [no_rawat, tgl_perawatan, jam_rawat]);
      } else {
        // Delete from pemeriksaan_ranap table
        table = 'pemeriksaan_ranap';
        [result] = await db.execute(`
          DELETE FROM pemeriksaan_ranap 
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        `, [no_rawat, tgl_perawatan, jam_rawat]);
      }

      console.log('Delete result:', result);

      if (result.affectedRows === 0) {
        throw new Error('No examination record found to delete');
      }

      return {
        success: true,
        message: 'Examination deleted successfully',
        table: table,
        affectedRows: result.affectedRows
      };

    } catch (error) {
      console.error('Error in delete examination service:', error);
      throw error;
    }
  }
}

export default DeleteExaminationService;