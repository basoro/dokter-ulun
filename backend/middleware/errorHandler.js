// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    message: 'Internal Server Error',
    status: 500
  };

  // Validation error
  if (err.name === 'ValidationError') {
    error.message = 'Validation Error';
    error.status = 400;
    error.details = err.details;
  }

  // Database error
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    error.message = 'Database access denied';
    error.status = 500;
  }

  if (err.code === 'ECONNREFUSED') {
    error.message = 'Database connection refused';
    error.status = 500;
  }

  // Authentication error
  if (err.name === 'UnauthorizedError') {
    error.message = 'Unauthorized access';
    error.status = 401;
  }

  // Send error response
  res.status(error.status).json({
    success: false,
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
};

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};