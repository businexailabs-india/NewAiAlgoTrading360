import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, User } from '../services/authService';
import { API_BASE_URL } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureLocalGuestSession(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/local-guest`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data?.data?.accessToken) return null;
    localStorage.setItem('authToken', data.data.accessToken);
    if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    return data.data.user as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(authService.getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      const guest = await ensureLocalGuestSession();
      setUser(guest);
      return;
    }
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch {
      const guest = await ensureLocalGuestSession();
      if (!guest) {
        authService.logout();
        setUser(null);
      } else {
        setUser(guest);
      }
    }
  }, []);

  useEffect(() => {
    refreshProfile().finally(() => setIsLoading(false));
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    setUser(result.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await authService.register(email, password, name);
    setUser(result.data.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user || !!localStorage.getItem('authToken'),
        login,
        register,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
