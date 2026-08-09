import {
  TFLiteEngineNotImplementedError,
  TFLiteRecognitionEngine,
} from './TFLiteRecognitionEngine';

describe('TFLiteRecognitionEngine (M5-03 스텁)', () => {
  it('analyze()는 아직 구현되지 않았다는 에러로 거부한다', async () => {
    const engine = new TFLiteRecognitionEngine();
    await expect(engine.analyze({ durationMs: 15000 })).rejects.toBeInstanceOf(
      TFLiteEngineNotImplementedError,
    );
  });

  it('에러 메시지가 대안(mock 사용/fallback)을 알려준다', async () => {
    const engine = new TFLiteRecognitionEngine();
    await expect(engine.analyze({ durationMs: 15000 })).rejects.toThrow(
      /mock|fallbackToMock/,
    );
  });

  it('fallbackToMock을 켜면 Mock 판정을 위임받아 돌려준다', async () => {
    const engine = new TFLiteRecognitionEngine({ fallbackToMock: true });
    const result = await engine.analyze({ durationMs: 15000, demoMode: true });

    expect(result.finalDecision).toBe('TAKEN');
    expect(result.detections.map((d) => d.cls).sort()).toEqual([
      'face',
      'hand',
      'pill',
    ]);
  }, 15000);

  it('모델은 아직 로드되지 않은 상태다', () => {
    expect(new TFLiteRecognitionEngine().isModelLoaded).toBe(false);
  });

  it('모델 경로를 받아 보관한다 (M6-02에서 사용)', () => {
    const engine = new TFLiteRecognitionEngine({
      detectorModelPath: 'models/carelog-detector-v1.tflite',
      sequenceModelPath: 'models/carelog-sequence-v1.tflite',
    });

    expect(engine.detectorModelPath).toBe('models/carelog-detector-v1.tflite');
    expect(engine.sequenceModelPath).toBe('models/carelog-sequence-v1.tflite');
  });
});
