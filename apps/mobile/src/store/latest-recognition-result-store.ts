import type { RecognitionResult } from '@carelog/shared';
import { create } from 'zustand';

interface LatestRecognitionResultState {
  result: RecognitionResult | null;
  setResult: (result: RecognitionResult) => void;
  clear: () => void;
}

/** 분석 중 화면(M2-07)에서 얻은 최신 판정 결과를 결과 화면(M2-08)으로 전달하기 위한
 * 세션 한정(비영속) 스토어. */
export const useLatestRecognitionResultStore = create<LatestRecognitionResultState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  clear: () => set({ result: null }),
}));
