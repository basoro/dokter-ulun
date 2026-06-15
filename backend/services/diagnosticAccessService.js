class DiagnosticAccessService {
  static normalizeUsername(value) {
    return String(value || '').trim();
  }

  static parseAccessList(envKey) {
    const rawValue = String(process.env[envKey] || '').trim();

    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) {
        return [];
      }

      return parsedValue
        .map((item) => this.normalizeUsername(item))
        .filter(Boolean);
    } catch (error) {
      console.error(`Failed to parse ${envKey}:`, error);
      return [];
    }
  }

  static getFeatureConfig(feature) {
    if (feature === 'laboratorium') {
      return {
        envKey: 'DOCTOR_ACCESS_LAB',
        label: 'laboratorium'
      };
    }

    if (feature === 'radiologi') {
      return {
        envKey: 'DOCTOR_ACCESS_RAD',
        label: 'radiologi'
      };
    }

    throw new Error(`Fitur akses diagnostik tidak dikenali: ${feature}`);
  }

  static getAllowedUsernames(feature) {
    const config = this.getFeatureConfig(feature);
    return this.parseAccessList(config.envKey);
  }

  static canAccess(feature, username) {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      return false;
    }

    return this.getAllowedUsernames(feature).includes(normalizedUsername);
  }

  static ensureAccess(feature, username) {
    if (!this.canAccess(feature, username)) {
      const config = this.getFeatureConfig(feature);
      const error = new Error(`Anda tidak memiliki akses ke ${config.label}`);
      error.statusCode = 403;
      throw error;
    }
  }

  static async getAccessInfo(feature, username) {
    return {
      success: true,
      can_access: this.canAccess(feature, username),
      aliases: this.getAllowedUsernames(feature)
    };
  }
}

export default DiagnosticAccessService;
