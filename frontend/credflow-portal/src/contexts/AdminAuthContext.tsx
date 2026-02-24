import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { post, ApiClientError } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/config';
import {
  clearAdminSession,
  getAdminToken,
  getStoredAdmin,
  saveAdminSession,
  type StoredAdminUser,
} from '@/lib/api/adminAuth';
import { isValidBankerId } from '@/lib/api/bankerId';

type AdminLoginResult =
  | { ok: true; requiresOtp?: false }
  | { ok: true; requiresOtp: true; otpSessionId: string; message?: string }
  | { ok: false; error?: string };

interface AdminAuthContextType {
  admin: StoredAdminUser | null;
  isAuthenticated: boolean;
  login: (bankerId: string, password: string) => Promise<AdminLoginResult>;
  verifyOtp: (otpSessionId: string, bankerId: string, otp: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function saveLoginResponse(response: {
  token: string;
  bankerId: string;
  name: string;
  role: string;
  bankId: string;
  bankName: string;
  bankCode?: string;
  isPlatformAdmin?: boolean;
}) {
  const user: StoredAdminUser = {
    bankerId: response.bankerId,
    name: response.name,
    role: response.role,
    bankId: response.bankId,
    bankName: response.bankName,
    bankCode: response.bankCode,
    isPlatformAdmin: response.isPlatformAdmin ?? response.bankId === 'BANK_CREDFLOW',
  };
  saveAdminSession(response.token, user);
  return user;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() => getAdminToken());
  const [admin, setAdmin] = useState<StoredAdminUser | null>(() => {
    const user = getStoredAdmin();
    const token = getAdminToken();
    if (user && token) return user;
    if (user || token) clearAdminSession();
    return null;
  });

  useEffect(() => {
    const onSessionCleared = () => {
      setAdmin(null);
      setSessionToken(null);
    };
    window.addEventListener('credflow-admin-session-cleared', onSessionCleared);
    return () => window.removeEventListener('credflow-admin-session-cleared', onSessionCleared);
  }, []);

  const login = async (bankerId: string, password: string): Promise<AdminLoginResult> => {
    if (!isValidBankerId(bankerId)) {
      return { ok: false, error: 'Enter the Banker ID issued to you by CredFlow admin' };
    }
    if (!password.trim()) {
      return { ok: false, error: 'Password is required' };
    }

    try {
      const response = await post<{
        status: string;
        requiresOtp?: boolean;
        otpSessionId?: string;
        message?: string;
        token?: string;
        bankerId?: string;
        name?: string;
        role?: string;
        bankId?: string;
        bankName?: string;
        bankCode?: string;
        isPlatformAdmin?: boolean;
      }>(API_ENDPOINTS.ADMIN_LOGIN, { bankerId: bankerId.trim(), password });

      if (response.requiresOtp && response.otpSessionId) {
        return {
          ok: true,
          requiresOtp: true,
          otpSessionId: response.otpSessionId,
          message: response.message,
        };
      }

      if (!response.token || !response.bankerId) {
        return { ok: false, error: 'Unexpected login response' };
      }

      const user = saveLoginResponse(response as Required<typeof response>);
      setAdmin(user);
      setSessionToken(response.token);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Admin login failed. Check credentials and try again.';
      return { ok: false, error: message };
    }
  };

  const verifyOtp = async (otpSessionId: string, bankerId: string, otp: string) => {
    try {
      const response = await post<{
        token: string;
        bankerId: string;
        name: string;
        role: string;
        bankId: string;
        bankName: string;
        bankCode?: string;
        isPlatformAdmin?: boolean;
      }>(API_ENDPOINTS.ADMIN_LOGIN_VERIFY_OTP, {
        otpSessionId,
        bankerId: bankerId.trim(),
        otp: otp.trim(),
      });

      const user = saveLoginResponse(response);
      setAdmin(user);
      setSessionToken(response.token);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Invalid or expired verification code';
      return { ok: false, error: message };
    }
  };

  const logout = () => {
    setAdmin(null);
    setSessionToken(null);
    clearAdminSession();
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin && !!sessionToken,
        login,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
