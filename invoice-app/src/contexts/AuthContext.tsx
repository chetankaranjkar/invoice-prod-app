import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../services/agent';
import type { UserProfile } from '../types';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  loadProfile: () => Promise<UserProfile | null>;
  setProfile: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try {
      setLoading(true);
      const response = await api.user.getProfile();
      setProfileState(response.data);
      return response.data;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load user profile:', err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      loadProfile();
    }
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ profile, loading, loadProfile, setProfile }}>
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
