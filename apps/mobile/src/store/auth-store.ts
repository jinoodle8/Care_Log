import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@carelog/shared';
import { create } from 'zustand';
import { setAuthToken } from '@/api/client';

export const AUTH_STORAGE_KEY = 'carelog.auth';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isLoaded: boolean;
  load: () => Promise<void>;
  setAuth: (auth: StoredAuth) => Promise<void>;
  clearAuth: () => Promise<void>;
}

function parseAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (typeof parsed.accessToken !== 'string' || !parsed.user) return null;
    return parsed as StoredAuth;
  } catch {
    return null;
  }
}

/** 보호자 로그인 세션. 저장된 access token은 API 클라이언트 헤더에도 함께 반영한다. */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoaded: false,

  load: async () => {
    const stored = parseAuth(await AsyncStorage.getItem(AUTH_STORAGE_KEY));
    setAuthToken(stored?.accessToken ?? null);
    set({
      accessToken: stored?.accessToken ?? null,
      refreshToken: stored?.refreshToken ?? null,
      user: stored?.user ?? null,
      isLoaded: true,
    });
  },

  setAuth: async (auth: StoredAuth) => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    setAuthToken(auth.accessToken);
    set({ ...auth, isLoaded: true });
  },

  clearAuth: async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    set({ accessToken: null, refreshToken: null, user: null, isLoaded: true });
  },
}));
