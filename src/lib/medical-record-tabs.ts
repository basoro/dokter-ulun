export const OPEN_MEDICAL_RECORD_TAB_EVENT = 'open-medical-record-tab';
export const CLOSE_ALL_MEDICAL_RECORD_TABS_EVENT = 'close-all-medical-record-tabs';

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

export const dispatchCloseAllMedicalRecordTabs = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(CLOSE_ALL_MEDICAL_RECORD_TABS_EVENT));
};
