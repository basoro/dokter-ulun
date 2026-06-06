
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/logo.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { login, sendOTP, verifyOTP, completeLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Error',
        description: 'Username atau password harus diisi',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        if (result.requiresOTP && result.phoneNumber) {
          // Show OTP input and send OTP
          setPhoneNumber(result.phoneNumber);
          setShowOTP(true);
          
          // Automatically send OTP
          const otpSent = await sendOTP(result.phoneNumber, username);
          if (otpSent) {
            setOtpSent(true);
            toast({
              title: 'OTP Terkirim',
              description: `Kode OTP telah dikirim ke WhatsApp ${result.phoneNumber}`,
            });
          } else {
            toast({
              title: 'Error',
              description: 'Gagal mengirim OTP. Silakan coba lagi.',
              variant: 'destructive',
            });
          }
        } else {
          // Direct login without 2FA
          toast({
            title: 'Login Berhasil',
            description: 'Selamat datang kembali',
          });
          navigate('/');
        }
      } else {
        toast({
          title: 'Login Gagal',
          description: 'Username atau password salah',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat login',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast({
        title: 'Error',
        description: 'Masukkan kode OTP 6 digit',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const verified = await verifyOTP(phoneNumber, username, otp);
      
      if (verified) {
        // Complete the login process
        const loginSuccess = await completeLogin(username, password);
        
        if (loginSuccess) {
          // Set cookies for remember me functionality
          if (remember) {
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 1);
            document.cookie = `username=${username}; expires=${expires.toUTCString()}; path=/`;
          }

          toast({
            title: 'Login Berhasil',
            description: 'Selamat datang kembali',
          });
          navigate('/');
        } else {
          toast({
            title: 'Error',
            description: 'Gagal menyelesaikan login',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'OTP Salah',
          description: 'Kode OTP tidak valid atau sudah kadaluarsa',
          variant: 'destructive',
        });
        setOtp('');
      }
    } catch (error) {
      console.error('OTP Verification error:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat verifikasi OTP',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    
    try {
      const otpSent = await sendOTP(phoneNumber, username);
      if (otpSent) {
        toast({
          title: 'OTP Terkirim',
          description: `Kode OTP baru telah dikirim ke WhatsApp ${phoneNumber}`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Gagal mengirim OTP. Silakan coba lagi.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat mengirim ulang OTP',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowOTP(false);
    setOtpSent(false);
    setOtp('');
    setPhoneNumber('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-primary p-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <img 
                src={logoImg} 
                alt="Hospital Logo" 
                className="h-20 w-20 object-contain"
              />
            </div>            
            <h1 className="text-2xl font-bold">RSUD H. DAMANHURI</h1>
            <p className="mt-2 opacity-80">
              {showOTP ? 'Verifikasi OTP WhatsApp' : 'Login to access your account'}
            </p>
          </div>
          
          {!showOTP ? (
            // Login Form
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="remember" className="text-sm">
                  Ingat saya
                </Label>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          ) : (
            // OTP Verification Form
            <form onSubmit={handleOTPSubmit} className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <Phone className="h-12 w-12 text-primary" />
                </div>
                <p className="text-sm text-gray-600">
                  Masukkan kode OTP 6 digit yang telah dikirim ke WhatsApp
                </p>
                <p className="font-medium text-primary">{phoneNumber}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex flex-col space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? 'Verifying...' : 'Verifikasi OTP'}
                  </Button>

                  <div className="flex justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={resendLoading}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      {resendLoading ? 'Mengirim...' : 'Kirim Ulang OTP'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="text-gray-600 hover:underline"
                    >
                      Kembali ke Login
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
