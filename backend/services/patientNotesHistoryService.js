import { executeQuery } from '../config/database.js';

class PatientNotesHistoryService {
  // Service ini tidak digunakan - riwayat catatan_perawatan ditampilkan langsung dari visit details
  // yang sudah termasuk catatan_perawatan dalam response GET /api/get-medical-record-visit-details
  static async getNotesHistory(req, res) {
    return res.json({
      success: true,
      data: []
    });
  }
}

export default PatientNotesHistoryService;
