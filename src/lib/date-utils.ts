
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

// Keep calendar-date filters stable across browser timezones.
export const formatLocalDateValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseLocalDateValue = (value: string | null, fallback: Date): Date => {
  if (!value) {
    return fallback;
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return fallback;
  }

  const [, year, month, day] = match;
  // Use midday local time so the selected calendar date stays stable after reloads.
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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

export const parseDateLike = (value: string | Date | number | null | undefined): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const parsedFromNumber = new Date(value);
    return Number.isNaN(parsedFromNumber.getTime()) ? null : parsedFromNumber;
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const mysqlLikeValue = normalized
    .replace(/Z$/, '')
    .replace(' ', 'T');
  const fallbackDate = new Date(mysqlLikeValue);

  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

export const formatDateTimeIndonesia = (
  value: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string => {
  const parsedDate = parseDateLike(value);
  if (!parsedDate) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  }).format(parsedDate);
};

export const formatDateIndonesia = (
  value: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string => {
  const parsedDate = parseDateLike(value);
  if (!parsedDate) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options
  }).format(parsedDate);
};
