
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_CONFIG } from '@/config/api';
import { loadNotificationPreferences } from '@/lib/notification-preferences';

// Define user type
interface User {
  id: string;
  username: string;
  name: string;
  kd_dokter?: string;
  role: 'doctor' | 'admin' | 'nurse' | 'staff' | 'medis';
  kd_poli: string;
  all_poli?: string[];
  jenis_poli?: string;
  jenis_poli_sore?: string;
  jadwal_poli?: Array<{
    kd_poli: string;
    nm_poli: string;
  }>;
  jk: 'L' | 'P';
  no_telp?: string;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{success: boolean, requiresOTP?: boolean, phoneNumber?: string, otpRequiredByServer?: boolean}>;
  sendOTP: (phoneNumber: string, username: string) => Promise<boolean>;
  verifyOTP: (phoneNumber: string, username: string, otp: string) => Promise<boolean>;
  completeLogin: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Backend API configuration
const API_BASE_URL = API_CONFIG.BASE_URL_WITHOUT_API;

// Real API call using backend Express server
const loginApi = async (username: string, password: string): Promise<{token: string, user: User, otpRequiredByServer: boolean} | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      console.error('Login API error:', response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.success && data.user) {
      // Create a mock JWT token for the session
      const token = `backend-auth-${data.user.username}-${Date.now()}`;
      
      return {
        token,
        user: {
          id: data.user.id_user || data.user.username,
          username: data.user.username,
          name: data.user.fullname || data.user.username, // Use fullname or username as fallback
          kd_dokter: data.user.username,
          role: 'medis', // Default role, you can enhance this based on your DB
          kd_poli: data.user.kd_poli || '',
          all_poli: data.user.all_poli || [],
          jenis_poli: data.user.jenis_poli || '',
          jenis_poli_sore: data.user.jenis_poli_sore || '',
          jadwal_poli: data.user.jadwal_poli || [],
          jk: data.user.jk || 'L', // Default to 'L' if not provided
          no_telp: data.user.no_telp
        },
        otpRequiredByServer: Boolean(data.otp_required_by_server)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Login API error:', error);
    return null;
  }
};

const clearPersistedAuth = () => {
  localStorage.removeItem('auth-token');
  localStorage.removeItem('auth-user');
};

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check for existing token on app load
  useEffect(() => {
    const loadUserFromStorage = () => {
      const storedToken = localStorage.getItem('auth-token');
      const storedUser = localStorage.getItem('auth-user');
      
      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse stored user', error);
          // Clear invalid storage data
          clearPersistedAuth();
        }
      }
      
      setLoading(false);
    };
    
    loadUserFromStorage();
  }, []);
  
  // Initial login function - returns whether 2FA is required
  const login = async (username: string, password: string): Promise<{success: boolean, requiresOTP?: boolean, phoneNumber?: string, otpRequiredByServer?: boolean}> => {
    // Clear session lama lebih dulu agar request setelah login tidak memakai user sebelumnya.
    setToken(null);
    setUser(null);
    clearPersistedAuth();
    setLoading(true);
    try {
      const response = await loginApi(username, password);
      
      if (response && response.token && response.user) {
        const preferences = loadNotificationPreferences();
        const otpRequiredByServer = Boolean(response.otpRequiredByServer);
        const requiresOTP = otpRequiredByServer || preferences.otpLogin !== false;

        if (!requiresOTP) {
          setToken(response.token);
          setUser(response.user);
          localStorage.setItem('auth-token', response.token);
          localStorage.setItem('auth-user', JSON.stringify(response.user));
          setLoading(false);

          return {
            success: true,
            requiresOTP: false,
            otpRequiredByServer
          };
        }

        setLoading(false);
        
        // Get phone number from user data from mysql-auth function
        const phoneNumber = response.user.no_telp || '081250067788'; // Fallback to default if no phone number
        
        return {
          success: true,
          requiresOTP: true,
          phoneNumber: phoneNumber,
          otpRequiredByServer
        };
      }
      
      setLoading(false);
      return { success: false };
    } catch (error) {
      console.error('Login error', error);
      setLoading(false);
      return { success: false };
    }
  };

  // Send OTP via WhatsApp
  const sendOTP = async (phoneNumber: string, username: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber, username })
      });

      if (!response.ok) {
        console.error('Send OTP error:', response.statusText);
        return false;
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error('Send OTP error:', error);
      return false;
    }
  };

  // Verify OTP
  const verifyOTP = async (phoneNumber: string, username: string, otp: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber, username, otp })
      });

      if (!response.ok) {
        console.error('Verify OTP error:', response.statusText);
        return false;
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.error('Verify OTP error:', error);
      return false;
    }
  };

  // Complete login after OTP verification
  const completeLogin = async (username: string, password: string): Promise<boolean> => {
    setToken(null);
    setUser(null);
    clearPersistedAuth();
    setLoading(true);
    try {
      const response = await loginApi(username, password);
      
      if (response && response.token && response.user) {
        // Save to state
        setToken(response.token);
        setUser(response.user);
        
        // Save to localStorage
        localStorage.setItem('auth-token', response.token);
        localStorage.setItem('auth-user', JSON.stringify(response.user));
        
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Complete login error', error);
      setLoading(false);
      return false;
    }
  };
  
  // Logout function
  const logout = () => {
    // Clear state
    setToken(null);
    setUser(null);
    
    // Clear localStorage
    clearPersistedAuth();
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        sendOTP,
        verifyOTP,
        completeLogin,
        logout,
        isAuthenticated: !!user && !!token,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
