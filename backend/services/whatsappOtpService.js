import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class WhatsappOtpService {
  static isOtpSendEnabled() {
    return !['false', '0', 'no', 'off'].includes(
      (process.env.WA_OTP_SEND_ENABLED || 'true').toLowerCase()
    );
  }

  /**
   * Send OTP via WhatsApp
   * @param {string} phoneNumber - User's phone number
   * @param {string} username - User's username
   * @returns {Promise<Object>} - Response with OTP details
   */
  static async sendOTP(phoneNumber, username) {
    try {
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

      const isOtpSendEnabled = this.isOtpSendEnabled();
      const bypassOtp = process.env.WA_OTP_BYPASS_CODE || '123456';

      // Generate OTP or use bypass OTP from environment
      const otp = isOtpSendEnabled
        ? Math.floor(100000 + Math.random() * 900000).toString()
        : bypassOtp;
      
      // Clean phone number (remove leading 0 and add 62)
      let cleanNumber = phoneNumber.replace(/^0/, '62');
      if (!cleanNumber.startsWith('62')) {
        cleanNumber = '62' + cleanNumber;
      }

      // Prepare WhatsApp message
      const message = `Kode OTP untuk login RSUD H. DAMANHURI: ${otp}\n\nKode ini berlaku selama 5 menit.\nJangan berikan kode ini kepada siapa pun.`;

      // Store OTP with expiration (5 minutes)
      const otpData = {
        otp,
        phoneNumber: cleanNumber,
        username,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
      };

      // In a real implementation, you'd store this in a database
      // For now, we'll use a global Map to store OTPs (this is temporary and will be lost on server restart)
      if (!global.otpStore) {
        global.otpStore = new Map();
      }
      
      // Use phone number as key
      global.otpStore.set(cleanNumber, otpData);

      if (isOtpSendEnabled) {
        // Send WhatsApp message using WA Gateway only when OTP delivery is enabled.
        const waGatewayUrl = process.env.WA_GATEWAY_URL;
        const apiKey = process.env.WA_GATEWAY_API_KEY;
        const senderNumber = process.env.WA_SENDER_NUMBER;

        if (!waGatewayUrl || !apiKey || !senderNumber) {
          throw new Error('WA Gateway configuration is missing in environment variables');
        }

        const formData = new URLSearchParams();
        formData.append('api_key', apiKey);
        formData.append('sender', senderNumber);
        formData.append('number', cleanNumber);
        formData.append('message', message);
        formData.append('type', 'text');

        console.log('Sending WhatsApp OTP to:', cleanNumber);

        const waResponse = await axios.post(waGatewayUrl, formData.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        if (waResponse.status !== 200) {
          throw new Error(`WhatsApp gateway error: ${waResponse.data}`);
        }
      } else {
        console.log('WhatsApp OTP sending is disabled, using bypass OTP for:', cleanNumber);
      }
      
      console.log('OTP generated:', { username, phoneNumber: cleanNumber, expiresAt: otpData.expiresAt });

      return {
        success: true,
        message: isOtpSendEnabled ? 'OTP sent successfully' : 'OTP bypass is enabled',
        // Remove this in production - only for testing
        debug: process.env.NODE_ENV === 'development' || !isOtpSendEnabled ? { otp, expiresAt: otpData.expiresAt } : undefined
      };

    } catch (error) {
      console.error('Error sending WhatsApp OTP:', error);
      throw error;
    }
  }

  /**
   * Verify OTP received via WhatsApp
   * @param {string} phoneNumber - User's phone number
   * @param {string} username - User's username
   * @param {string} otp - OTP to verify
   * @returns {Promise<Object>} - Response with verification result
   */
  static async verifyOTP(phoneNumber, username, otp) {
    try {
      if (!phoneNumber || !username || !otp) {
        throw new Error('Phone number, username, and OTP are required');
      }

      // Clean phone number (same as in sendOTP)
      let cleanNumber = phoneNumber.replace(/^0/, '62');
      if (!cleanNumber.startsWith('62')) {
        cleanNumber = '62' + cleanNumber;
      }

      console.log('Verifying OTP for:', { username, phoneNumber: cleanNumber, otp });

      // Check OTP format
      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return {
          success: false,
          error: 'Invalid OTP format'
        };
      }

      // Get stored OTP data
      if (!global.otpStore) {
        return {
          success: false,
          error: 'No OTP found'
        };
      }

      const storedOtpData = global.otpStore.get(cleanNumber);
      
      if (!storedOtpData) {
        return {
          success: false,
          error: 'No OTP found for this phone number'
        };
      }

      // Check if OTP has expired
      const now = new Date();
      const expiresAt = new Date(storedOtpData.expiresAt);
      
      if (now > expiresAt) {
        // Remove expired OTP
        global.otpStore.delete(cleanNumber);
        
        return {
          success: false,
          error: 'OTP has expired'
        };
      }

      // Verify OTP
      if (storedOtpData.otp !== otp) {
        return {
          success: false,
          error: 'Invalid OTP'
        };
      }

      // OTP is valid - remove it from store to prevent reuse
      global.otpStore.delete(cleanNumber);

      console.log('OTP verified successfully for:', username);
      
      return {
        success: true,
        message: 'OTP verified successfully'
      };

    } catch (error) {
      console.error('Error verifying WhatsApp OTP:', error);
      throw error;
    }
  }
}

export default WhatsappOtpService;
