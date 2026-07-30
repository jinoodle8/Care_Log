import type { RecognitionEngine } from '@carelog/shared';
import { MockRecognitionEngine, type MockRecognitionEngineOptions } from './MockRecognitionEngine';

export { MockRecognitionEngine } from './MockRecognitionEngine';
export type { MockRecognitionEngineOptions } from './MockRecognitionEngine';

export type RecognitionEngineKind = 'mock' | 'tflite';

export interface GetRecognitionEngineOverrides extends MockRecognitionEngineOptions {
  kind?: RecognitionEngineKind;
}

function readEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = value !== undefined ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true';
}

let cachedEngine: RecognitionEngine | null = null;

/** `EXPO_PUBLIC_RECOGNITION_ENGINE` 빌드타임 플래그(기본값 mock)에 따라 RecognitionEngine 구현체를
 * 반환한다. M1~M4 구간에서는 항상 mock을 사용하고, 실모델(TFLiteRecognitionEngine)은 M5~에서
 * 추가한다. `overrides`는 테스트 및 개발자 설정 화면(M2-03)에서 값을 직접 주입할 때 사용한다. */
export function getRecognitionEngine(overrides: GetRecognitionEngineOverrides = {}): RecognitionEngine {
  if (cachedEngine && Object.keys(overrides).length === 0) {
    return cachedEngine;
  }

  const kind: RecognitionEngineKind =
    overrides.kind ?? (process.env.EXPO_PUBLIC_RECOGNITION_ENGINE as RecognitionEngineKind | undefined) ?? 'mock';

  if (kind === 'tflite') {
    throw new Error(
      'TFLiteRecognitionEngine은 아직 지원되지 않습니다 (M5~ 도입 예정). RECOGNITION_ENGINE=mock을 사용하세요.',
    );
  }

  const engine = new MockRecognitionEngine({
    takenRate: overrides.takenRate ?? readEnvNumber(process.env.EXPO_PUBLIC_MOCK_TAKEN_RATE, 0.9),
    uncertainRate: overrides.uncertainRate ?? readEnvNumber(process.env.EXPO_PUBLIC_MOCK_UNCERTAIN_RATE, 0.08),
    demoMode: overrides.demoMode ?? readEnvBoolean(process.env.EXPO_PUBLIC_DEMO_MODE, false),
    delayMsRange: overrides.delayMsRange,
  });

  if (Object.keys(overrides).length === 0) {
    cachedEngine = engine;
  }
  return engine;
}

/** 테스트 전용: 캐시된 엔진 인스턴스를 초기화한다. */
export function resetRecognitionEngineCache(): void {
  cachedEngine = null;
}
