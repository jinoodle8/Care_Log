import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type UserRole = 'ELDER' | 'GUARDIAN';

export const ROLE_STORAGE_KEY = 'carelog.role';

interface RoleState {
  role: UserRole | null;
  isLoaded: boolean;
  loadRole: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  clearRole: () => Promise<void>;
}

function parseRole(value: string | null): UserRole | null {
  return value === 'ELDER' || value === 'GUARDIAN' ? value : null;
}

export const useRoleStore = create<RoleState>((set) => ({
  role: null,
  isLoaded: false,

  loadRole: async () => {
    const stored = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
    set({ role: parseRole(stored), isLoaded: true });
  },

  setRole: async (role: UserRole) => {
    await AsyncStorage.setItem(ROLE_STORAGE_KEY, role);
    set({ role, isLoaded: true });
  },

  clearRole: async () => {
    await AsyncStorage.removeItem(ROLE_STORAGE_KEY);
    set({ role: null, isLoaded: true });
  },
}));
