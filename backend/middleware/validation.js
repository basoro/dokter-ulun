// Input validation middleware
export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  // Validate username
  if (!username) {
    errors.push('Username is required');
  } else if (typeof username !== 'string') {
    errors.push('Username must be a string');
  } else if (username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  // Validate password
  if (!password) {
    errors.push('Password is required');
  } else if (typeof password !== 'string') {
    errors.push('Password must be a string');
  } else if (password.length < 4) {
    errors.push('Password must be at least 4 characters long');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize input
  req.body.username = username.trim().toLowerCase();
  req.body.password = password;

  next();
};

// Validate medical record request
export const validateMedicalRecord = (req, res, next) => {
  const { no_rkm_medis, no_rawat } = req.body;
  const errors = [];

  if (!no_rkm_medis) {
    errors.push('Medical record number is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// Validate patient data request
export const validatePatientData = (req, res, next) => {
  const { kd_poli, startDate, endDate } = req.body;
  const errors = [];

  if (!kd_poli) {
    errors.push('Kode poli is required');
  }

  if (!startDate) {
    errors.push('Start date is required');
  }

  if (!endDate) {
    errors.push('End date is required');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !dateRegex.test(startDate)) {
    errors.push('Start date must be in YYYY-MM-DD format');
  }

  if (endDate && !dateRegex.test(endDate)) {
    errors.push('End date must be in YYYY-MM-DD format');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// General sanitization
export const sanitizeInput = (req, res, next) => {
  // Remove any potential SQL injection characters
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Basic sanitization - remove dangerous characters
        obj[key] = obj[key].replace(/[<>"'%;()&+]/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};