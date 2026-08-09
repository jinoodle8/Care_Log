import { create } from 'zustand';

interface RecordedVideoState {
  /** 직전 녹화 파일의 로컬 URI. 업로드가 끝나면 비운다. */
  uri: string | null;
  setUri: (uri: string | null) => void;
  clear: () => void;
}

/**
 * 녹화 화면 → 분석 화면으로 영상 파일 위치만 전달한다.
 * 영상 자체는 메모리에 담지 않고, 업로드가 끝나면 참조를 버린다.
 */
export const useRecordedVideoStore = create<RecordedVideoState>((set) => ({
  uri: null,
  setUri: (uri) => set({ uri }),
  clear: () => set({ uri: null }),
}));
