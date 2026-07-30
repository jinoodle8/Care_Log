import { MockRecognitionEngine } from './MockRecognitionEngine';
import { getRecognitionEngine, resetRecognitionEngineCache } from './index';

describe('getRecognitionEngine', () => {
  afterEach(() => {
    resetRecognitionEngineCache();
  });

  it('기본값(kind 미지정)이면 MockRecognitionEngine을 반환한다', () => {
    const engine = getRecognitionEngine();
    expect(engine).toBeInstanceOf(MockRecognitionEngine);
  });

  it('kind: tflite이면 아직 지원하지 않는다는 에러를 던진다', () => {
    expect(() => getRecognitionEngine({ kind: 'tflite' })).toThrow(/TFLiteRecognitionEngine/);
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
