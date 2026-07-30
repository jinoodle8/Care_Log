export interface Detection {
  cls: 'face' | 'pill' | 'hand';
  conf: number;
  bbox: [number, number, number, number];
}

export type ActionStep = 'pick_up' | 'hand_to_mouth' | 'swallow' | 'drink_water';

export interface RecognitionResult {
  detections: Detection[];
  actionSequence: ActionStep[];
  sequenceConf: number;
  finalDecision: 'TAKEN' | 'UNCERTAIN' | 'MISSED';
}

/** 녹화 세션(약 10~15초) 프레임 스트림. M1~M4는 Mock이 소비하는 최소 필드만 사용하고,
 * M5에서 vision-camera 프레임 스트림 타입으로 확장한다. */
export interface FrameSource {
  durationMs: number;
  demoMode?: boolean;
}

export interface RecognitionEngine {
  /** 녹화 세션(약 10~15초) 프레임 스트림을 받아 판정 */
  analyze(session: FrameSource): Promise<RecognitionResult>;
}
