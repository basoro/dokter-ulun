
import { id } from 'date-fns/locale';

// Make sure the Indonesian locale is properly exported
export const indonesianLocale = id;

// Helper to convert any date to Indonesian timezone (WIB = UTC+7)
export const toIndonesianTime = (date: Date): Date => {
  return new Date(date.getTime() + (7 * 60 * 60 * 1000));
};

// Format date to YYYY-MM-DD HH:mm:ss in WIB timezone
export const formatDateTimeWIB = (date: Date): string => {
  const wibDate = toIndonesianTime(date);
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getUTCDate()).padStart(2, '0');
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Format date to YYYY-MM-DD in WIB timezone
export const formatDateWIB = (date: Date): string => {
  const wibDate = toIndonesianTime(date);
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Format time to HH:mm in WIB timezone
export const formatTimeWIB = (date: Date): string => {
  const wibDate = toIndonesianTime(date);
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
};

export const formatIndonesianDate = (date: Date | undefined): string => {
  if (!date) return "";
  
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
