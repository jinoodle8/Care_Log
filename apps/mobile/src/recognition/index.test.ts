import { MockRecognitionEngine } from './MockRecognitionEngine';
import { TFLiteRecognitionEngine } from './TFLiteRecognitionEngine';
import { getRecognitionEngine, resetRecognitionEngineCache } from './index';

describe('getRecognitionEngine', () => {
  const originalEngineEnv = process.env.EXPO_PUBLIC_RECOGNITION_ENGINE;

  afterEach(() => {
    resetRecognitionEngineCache();
    process.env.EXPO_PUBLIC_RECOGNITION_ENGINE = originalEngineEnv;
  });

  it('기본값(kind 미지정)이면 MockRecognitionEngine을 반환한다', () => {
    const engine = getRecognitionEngine();
    expect(engine).toBeInstanceOf(MockRecognitionEngine);
  });

  it('kind: tflite이면 TFLiteRecognitionEngine을 반환한다 (M5-03)', () => {
    const engine = getRecognitionEngine({ kind: 'tflite' });
    expect(engine).toBeInstanceOf(TFLiteRecognitionEngine);
  });

  it('env 플래그가 tflite면 TFLiteRecognitionEngine을 반환한다', () => {
    process.env.EXPO_PUBLIC_RECOGNITION_ENGINE = 'tflite';
    expect(getRecognitionEngine()).toBeInstanceOf(TFLiteRecognitionEngine);
  });

  it('env 플래그가 mock이면 MockRecognitionEngine을 반환한다', () => {
    process.env.EXPO_PUBLIC_RECOGNITION_ENGINE = 'mock';
    expect(getRecognitionEngine()).toBeInstanceOf(MockRecognitionEngine);
  });

  it('env 플래그가 없으면 mock이 기본값이다 (M6-07 전까지 유지)', () => {
    delete process.env.EXPO_PUBLIC_RECOGNITION_ENGINE;
    expect(getRecognitionEngine()).toBeInstanceOf(MockRecognitionEngine);
  });

  it(
    'demoMode: true이면 항상 TAKEN을 반환하는 엔진을 만든다',
    async () => {
      const engine = getRecognitionEngine({ demoMode: true, delayMsRange: [0, 0] });

      for (let i = 0; i < 5; i += 1) {
        const result = await engine.analyze({ durationMs: 10000 });
        expect(result.finalDecision).toBe('TAKEN');
      }
    },
    10000,
  );

  it('오버라이드 없이 호출하면 동일 프로세스 내에서 인스턴스를 캐시해 재사용한다', () => {
    const first = getRecognitionEngine();
    const second = getRecognitionEngine();
    expect(first).toBe(second);
  });

  it('오버라이드를 주면 캐시를 사용하지 않고 새 인스턴스를 만든다', () => {
    const cached = getRecognitionEngine();
    const overridden = getRecognitionEngine({ demoMode: true });
    expect(overridden).not.toBe(cached);
  });
});
