import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/authService.js';
import { validateLogin } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login endpoint
router.post('/login', loginLimiter, validateLogin, asyncHandler(async (req, res) => {
  const { username, password, remember } = req.body;
  
  try {
    const user = await AuthService.authenticateUser(username, password);
    
    // Generate session token (in production, use JWT or proper session management)
    const sessionToken = `session_${user.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      user,
      token: sessionToken,
      remember: remember || false,
      message: 'Login successful'
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
}));

// Get user profile
router.get('/profile/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  try {
    const user = await AuthService.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
}));

// Validate poli access
router.post('/validate-poli', asyncHandler(async (req, res) => {
  const { username, kd_poli } = req.body;
  
  if (!username || !kd_poli) {
    return res.status(400).json({
      success: false,
      error: 'Username and kd_poli are required'
    });
  }
  
  try {
    const hasAccess = await AuthService.validatePoliAccess(username, kd_poli);
    
    res.json({
      success: true,
      hasAccess,
      message: hasAccess ? 'Access granted' : 'Access denied'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate poli access'
    });
  }
}));

// Logout endpoint (for session cleanup if needed)
router.post('/logout', asyncHandler(async (req, res) => {
  // In a real application, you would invalidate the session/token here
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

export default router;