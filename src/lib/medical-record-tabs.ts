export const OPEN_MEDICAL_RECORD_TAB_EVENT = 'open-medical-record-tab';

export interface OpenMedicalRecordTabDetail {
  noRkmMedis: string;
  noRawat: string;
  patientName?: string;
  sourcePath?: string;
}

export const dispatchOpenMedicalRecordTab = (detail: OpenMedicalRecordTabDetail) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OpenMedicalRecordTabDetail>(OPEN_MEDICAL_RECORD_TAB_EVENT, {
      detail
    })
  );
};
