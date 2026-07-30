import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const RECOGNITION_SETTINGS_STORAGE_KEY = 'carelog.recognitionSettings';

export interface RecognitionSettings {
  demoMode: boolean;
  takenRate: number;
  uncertainRate: number;
}

export const DEFAULT_RECOGNITION_SETTINGS: RecognitionSettings = {
  demoMode: false,
  takenRate: 0.9,
  uncertainRate: 0.08,
};

interface RecognitionSettingsState extends RecognitionSettings {
  isLoaded: boolean;
  load: () => Promise<void>;
  setDemoMode: (demoMode: boolean) => Promise<void>;
  setTakenRate: (takenRate: number) => Promise<void>;
  setUncertainRate: (uncertainRate: number) => Promise<void>;
}

function parseSettings(raw: string | null): RecognitionSettings {
  if (!raw) return DEFAULT_RECOGNITION_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<RecognitionSettings>;
    return {
      demoMode: typeof parsed.demoMode === 'boolean' ? parsed.demoMode : DEFAULT_RECOGNITION_SETTINGS.demoMode,
      takenRate: typeof parsed.takenRate === 'number' ? parsed.takenRate : DEFAULT_RECOGNITION_SETTINGS.takenRate,
      uncertainRate:
        typeof parsed.uncertainRate === 'number'
          ? parsed.uncertainRate
          : DEFAULT_RECOGNITION_SETTINGS.uncertainRate,
    };
  } catch {
    return DEFAULT_RECOGNITION_SETTINGS;
  }
}

async function persist(settings: RecognitionSettings): Promise<void> {
  await AsyncStorage.setItem(RECOGNITION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/** 개발자 설정 화면(M2-03)에서 조정하는 Mock 인식 설정. 촬영 분석 시(M2-07) 이 값을
 * RecognitionEngine.analyze()의 session.demoMode 등으로 전달한다. */
export const useRecognitionSettingsStore = create<RecognitionSettingsState>((set, get) => ({
  ...DEFAULT_RECOGNITION_SETTINGS,
  isLoaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(RECOGNITION_SETTINGS_STORAGE_KEY);
    set({ ...parseSettings(raw), isLoaded: true });
  },

  setDemoMode: async (demoMode: boolean) => {
    const next = { ...toSettings(get()), demoMode };
    await persist(next);
    set(next);
  },

  setTakenRate: async (takenRate: number) => {
    const next = { ...toSettings(get()), takenRate };
    await persist(next);
    set(next);
  },

  setUncertainRate: async (uncertainRate: number) => {
    const next = { ...toSettings(get()), uncertainRate };
    await persist(next);
    set(next);
  },
}));

function toSettings(state: RecognitionSettingsState): RecognitionSettings {
  return { demoMode: state.demoMode, takenRate: state.takenRate, uncertainRate: state.uncertainRate };
}
