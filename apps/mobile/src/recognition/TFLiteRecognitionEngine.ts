import type {
  FrameSource,
  RecognitionEngine,
  RecognitionResult,
} from '@carelog/shared';
import { MockRecognitionEngine } from './MockRecognitionEngine';

export interface TFLiteRecognitionEngineOptions {
  /**
   * 실모델이 준비되기 전(M6 이전) 개발·데모용 탈출구.
   * true면 analyze()를 MockRecognitionEngine에 위임해 플래그만 tflite로 켜고도
   * 앱 전체 플로우를 돌려볼 수 있다. 기본값 false — 조용히 mock 결과를 진짜처럼
   * 흘리지 않기 위해 명시적으로 켜야 한다.
   */
  fallbackToMock?: boolean;
  /** 번들에 포함된 객체 인식 모델 경로(M5-06 규격). M6-02에서 실제 로드에 쓴다. */
  detectorModelPath?: string;
  /** 시퀀스 분류 모델 경로. 서버 추론으로 갈 경우 미사용(M6-03에서 결정). */
  sequenceModelPath?: string;
}

export class TFLiteEngineNotImplementedError extends Error {
  constructor() {
    super(
      'TFLiteRecognitionEngine.analyze()는 아직 구현되지 않았습니다 (M6-04 예정). ' +
        'EXPO_PUBLIC_RECOGNITION_ENGINE=mock을 쓰거나, 개발 중이라면 fallbackToMock을 켜세요.',
    );
    this.name = 'TFLiteEngineNotImplementedError';
  }
}

/**
 * 실모델 엔진 스텁(M5-03).
 *
 * `RecognitionEngine` 계약은 지금 확정해 두고, 실제 추론은 M6에서 채운다.
 * M6-04에서 이 클래스 안이 이렇게 채워진다:
 *   1. frame processor(M5-01)가 넘긴 프레임마다 YOLOv8n 추론 → Detection[]
 *   2. 프레임별 결과를 시퀀스 버퍼에 누적
 *   3. CNN-BiLSTM으로 시퀀스 분류 → actionSequence, sequenceConf
 *   4. 판정 정책(TRD 5.1)을 적용해 finalDecision 조립
 *
 * 이 파일은 `react-native-fast-tflite`를 import하지 않는다. 실모델 라이브러리는
 * M6에서 도입하며, 그전까지 앱 크기·빌드 복잡도를 늘리지 않는다(CLAUDE.md 7장).
 */
export class TFLiteRecognitionEngine implements RecognitionEngine {
  private readonly fallback: MockRecognitionEngine | null;

  readonly detectorModelPath?: string;
  readonly sequenceModelPath?: string;

  constructor(options: TFLiteRecognitionEngineOptions = {}) {
    this.fallback = options.fallbackToMock ? new MockRecognitionEngine() : null;
    this.detectorModelPath = options.detectorModelPath;
    this.sequenceModelPath = options.sequenceModelPath;
  }

  /** 실모델 로드 여부. M6-02에서 실제 인터프리터 상태를 반영한다. */
  get isModelLoaded(): boolean {
    return false;
  }

  analyze(session: FrameSource): Promise<RecognitionResult> {
    if (this.fallback) {
      return this.fallback.analyze(session);
    }
    return Promise.reject(new TFLiteEngineNotImplementedError());
  }
}
