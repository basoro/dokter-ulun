export type NotificationPreferenceType = 'prescription' | 'laboratory' | 'radiology';

export interface NotificationPreferences {
  prescription: boolean;
  laboratory: boolean;
  radiology: boolean;
  sound: boolean;
  otpLogin: boolean;
}

export const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'doctor-notification-preferences';
export const LEGACY_NOTIFICATION_SOUND_STORAGE_KEY = 'doctor-notification-sound-enabled';
export const NOTIFICATION_PREFERENCES_CHANGED_EVENT = 'doctor-notification-preferences-changed';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  prescription: true,
  laboratory: true,
  radiology: true,
  sound: true,
  otpLogin: false
};

export const loadNotificationPreferences = (): NotificationPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const rawValue = window.localStorage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY);
  const legacySoundValue = window.localStorage.getItem(LEGACY_NOTIFICATION_SOUND_STORAGE_KEY);

  try {
    const parsed = rawValue ? JSON.parse(rawValue) : {};

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(parsed || {}),
      sound: typeof parsed?.sound === 'boolean'
        ? parsed.sound
        : legacySoundValue !== 'false'
    };
  } catch {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      sound: legacySoundValue !== 'false'
    };
  }
};

export const saveNotificationPreferences = (preferences: NotificationPreferences) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    NOTIFICATION_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences)
  );
  window.localStorage.setItem(
    LEGACY_NOTIFICATION_SOUND_STORAGE_KEY,
    preferences.sound ? 'true' : 'false'
  );
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_CHANGED_EVENT, {
    detail: preferences
  }));
};
