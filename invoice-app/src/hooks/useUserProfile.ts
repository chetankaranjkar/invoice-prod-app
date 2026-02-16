import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/agent';
import type { UserProfile } from '../types';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.user.getProfile();
      setProfile(response.data);
      return response.data;
    } catch (err) {
      setError('Failed to load profile');
      if (import.meta.env.DEV) {
        console.error('Failed to load user profile:', err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { profile, loading, error, refreshProfile: loadProfile };
}
