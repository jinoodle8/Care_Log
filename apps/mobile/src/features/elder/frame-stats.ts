/**
 * frame processor 파이프라인의 처리량 계측(M5-01).
 * worklet 쪽은 카운터만 올리고, 실제 계산은 여기 순수 함수로 모아 테스트 가능하게 둔다.
 */

export interface FrameRateSample {
  /** 이 구간에서 처리한 프레임 수 */
  frameCount: number;
  /** 구간 길이(ms) */
  elapsedMs: number;
  /** 초당 프레임 수 */
  fps: number;
}

/** 목표 프레임 간 처리 시간(ms). 사업계획서 기준 중급기에서 프레임당 33ms 이하. */
export const TARGET_FRAME_BUDGET_MS = 33;

export function computeFps(frameCount: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (frameCount * 1000) / elapsedMs;
}

export function buildFrameRateSample(
  frameCount: number,
  elapsedMs: number,
): FrameRateSample {
  return {
    frameCount,
    elapsedMs,
    fps: Math.round(computeFps(frameCount, elapsedMs) * 10) / 10,
  };
}

/** 프레임당 평균 처리 시간(ms). M6 성능 리포트의 기준값이 된다. */
export function msPerFrame(sample: FrameRateSample): number {
  if (sample.frameCount <= 0) return 0;
  return Math.round((sample.elapsedMs / sample.frameCount) * 10) / 10;
}

/** 목표 예산(33ms/프레임) 안에 들어오는지. */
export function meetsFrameBudget(
  sample: FrameRateSample,
  budgetMs: number = TARGET_FRAME_BUDGET_MS,
): boolean {
  const perFrame = msPerFrame(sample);
  return perFrame > 0 && perFrame <= budgetMs;
}

export function formatFrameRateSample(sample: FrameRateSample): string {
  return `${sample.fps} fps (${sample.frameCount} frames / ${sample.elapsedMs}ms, ${msPerFrame(sample)}ms per frame)`;
}
