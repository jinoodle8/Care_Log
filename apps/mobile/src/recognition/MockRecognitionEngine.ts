import {
  TAKEN_THRESHOLD,
  UNCERTAIN_THRESHOLD,
  type ActionStep,
  type Decision,
  type Detection,
  type FrameSource,
  type RecognitionEngine,
  type RecognitionResult,
} from '@carelog/shared';

export interface MockRecognitionEngineOptions {
  /** finalDecision이 TAKEN으로 샘플링될 확률. 기본 0.90 */
  takenRate?: number;
  /** finalDecision이 UNCERTAIN으로 샘플링될 확률. 기본 0.08 */
  uncertainRate?: number;
  /** finalDecision이 MISSED로 샘플링될 확률. 기본 0.02 (takenRate+uncertainRate의 나머지) */
  missedRate?: number;
  /** true면 항상 TAKEN·sequenceConf=0.98을 반환한다 (데모 모드) */
  demoMode?: boolean;
  /** analyze() 응답까지의 랜덤 지연 범위(ms). 기본 [3000, 5000] */
  delayMsRange?: [number, number];
}

const FULL_SEQUENCE: ActionStep[] = ['pick_up', 'hand_to_mouth', 'swallow', 'drink_water'];
const DEMO_SEQUENCE_CONF = 0.98;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 화면 중앙 40~60% 범위 내 정규화(0~1) bbox를 랜덤 생성한다. */
function randomBBoxNearCenter(): [number, number, number, number] {
  const cx = randomInRange(0.4, 0.6);
  const cy = randomInRange(0.4, 0.6);
  const width = randomInRange(0.08, 0.2);
  const height = randomInRange(0.08, 0.2);
  const x1 = Math.max(0, cx - width / 2);
  const y1 = Math.max(0, cy - height / 2);
  const x2 = Math.min(1, cx + width / 2);
  const y2 = Math.min(1, cy + height / 2);
  return [round2(x1), round2(y1), round2(x2), round2(y2)];
}

function buildDetections(): Detection[] {
  const classes: Detection['cls'][] = ['face', 'pill', 'hand'];
  return classes.map((cls) => ({
    cls,
    conf: round2(randomInRange(0.85, 0.99)),
    bbox: randomBBoxNearCenter(),
  }));
}

function sampleDecision(takenRate: number, uncertainRate: number): Decision {
  const r = Math.random();
  if (r < takenRate) return 'TAKEN';
  if (r < takenRate + uncertainRate) return 'UNCERTAIN';
  return 'MISSED';
}

/** 판정 정책(TAKEN>=0.90, 0.60<=UNCERTAIN<0.90, MISSED<0.60)과 정합되는 sequenceConf를 생성한다. */
function sequenceConfFor(decision: Decision): number {
  if (decision === 'TAKEN') {
    return round2(randomInRange(TAKEN_THRESHOLD, 0.99));
  }
  if (decision === 'UNCERTAIN') {
    return round2(randomInRange(UNCERTAIN_THRESHOLD, TAKEN_THRESHOLD - 0.01));
  }
  return round2(randomInRange(0.1, UNCERTAIN_THRESHOLD - 0.01));
}

function actionSequenceFor(decision: Decision): ActionStep[] {
  if (decision === 'TAKEN') return [...FULL_SEQUENCE];
  if (decision === 'UNCERTAIN') return FULL_SEQUENCE.slice(0, 2);
  return [];
}

/** CLAUDE.md 4장 계약을 따르는 목(mock) 인식 엔진. 실모델(TFLiteRecognitionEngine)이 붙기 전까지
 * 전체 서비스 플로우(촬영→판정→로그)를 완성하는 데 사용한다. */
export class MockRecognitionEngine implements RecognitionEngine {
  private readonly takenRate: number;
  private readonly uncertainRate: number;
  private readonly demoMode: boolean;
  private readonly delayMsRange: [number, number];

  constructor(options: MockRecognitionEngineOptions = {}) {
    this.takenRate = options.takenRate ?? 0.9;
    this.uncertainRate = options.uncertainRate ?? 0.08;
    this.demoMode = options.demoMode ?? false;
    this.delayMsRange = options.delayMsRange ?? [3000, 5000];
  }

  async analyze(session: FrameSource): Promise<RecognitionResult> {
    const demoMode = session.demoMode ?? this.demoMode;
    const [minDelay, maxDelay] = this.delayMsRange;
    await new Promise((resolve) => setTimeout(resolve, randomInRange(minDelay, maxDelay)));

    if (demoMode) {
      return {
        detections: buildDetections(),
        actionSequence: [...FULL_SEQUENCE],
        sequenceConf: DEMO_SEQUENCE_CONF,
        finalDecision: 'TAKEN',
      };
    }

    const decision = sampleDecision(this.takenRate, this.uncertainRate);
    return {
      detections: buildDetections(),
      actionSequence: actionSequenceFor(decision),
      sequenceConf: sequenceConfFor(decision),
      finalDecision: decision,
    };
  }
}
