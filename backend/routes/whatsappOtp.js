import express from 'express';
import rateLimit from 'express-rate-limit';
import WhatsappOtpService from '../services/whatsappOtpService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for OTP requests
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many OTP requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Send OTP endpoint
router.post('/send', otpLimiter, asyncHandler(async (req, res) => {
  const { phoneNumber, username } = req.body;
  
  if (!phoneNumber || !username) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and username are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.sendOTP(phoneNumber, username);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP',
      details: error.message
    });
  }
}));

// Verify OTP endpoint
router.post('/verify', asyncHandler(async (req, res) => {
  const { phoneNumber, username, otp } = req.body;
  
  if (!phoneNumber || !username || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Phone number, username, and OTP are required'
    });
  }
  
  try {
    const result = await WhatsappOtpService.verifyOTP(phoneNumber, username, otp);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP',
      details: error.message
    });
  }
}));

export default router;