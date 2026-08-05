import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const ELDER_ID_STORAGE_KEY = 'carelog.elderId';

interface ElderSessionState {
  elderId: string | null;
  isLoaded: boolean;
  load: () => Promise<void>;
  setElderId: (elderId: string) => Promise<void>;
}

/** 어르신 기기가 자신의 elderId를 기억해두는 스토어. 실제로는 M2-14(초대코드 연동)에서
 * 채워지며, 그 전까지는 개발자 설정 화면(M2-03)에서 QA용으로 직접 입력한다. */
export const useElderSessionStore = create<ElderSessionState>((set) => ({
  elderId: null,
  isLoaded: false,

  load: async () => {
    const stored = await AsyncStorage.getItem(ELDER_ID_STORAGE_KEY);
    set({ elderId: stored, isLoaded: true });
  },

  setElderId: async (elderId: string) => {
    await AsyncStorage.setItem(ELDER_ID_STORAGE_KEY, elderId);
    set({ elderId, isLoaded: true });
  },
}));
