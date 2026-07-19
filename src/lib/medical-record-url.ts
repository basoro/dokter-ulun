export const normalizeMedicalRecordVisitNoRawat = (noRawat: string) =>
  String(noRawat || '').replace(/\//g, '').trim();

export const formatMedicalRecordWorkspaceNoRawat = (noRawat: string) => {
  const normalizedNoRawat = String(noRawat || '').trim();

  if (!normalizedNoRawat || normalizedNoRawat.includes('/')) {
    return normalizedNoRawat;
  }

  if (normalizedNoRawat.length < 9) {
    return normalizedNoRawat;
  }

  return `${normalizedNoRawat.slice(0, 4)}/${normalizedNoRawat.slice(4, 6)}/${normalizedNoRawat.slice(6, 8)}/${normalizedNoRawat.slice(8)}`;
};

export const buildMedicalRecordVisitUrl = (noRkmMedis: string, noRawat: string) => {
  const normalizedNoRkmMedis = String(noRkmMedis || '').trim();
  const normalizedNoRawat = normalizeMedicalRecordVisitNoRawat(noRawat);

  return `/rekam-medik/${encodeURIComponent(normalizedNoRkmMedis)}/${encodeURIComponent(normalizedNoRawat)}`;
};
