/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, LoginResponse } from '@/lib/api/auth';

interface AuthContextType {
  user: LoginResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (custId: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: LoginResponse | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'credflow_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!storedUser) {
      const legacyUser = localStorage.getItem('trustkaro_user');
      if (legacyUser) {
        localStorage.setItem(USER_STORAGE_KEY, legacyUser);
        localStorage.removeItem('trustkaro_user');
        storedUser = legacyUser;
      }
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (custId: string, password: string) => {
    const response = await apiLogin({ custId, password });
    setUser(response);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
