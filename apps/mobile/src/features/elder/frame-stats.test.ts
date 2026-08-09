import {
  buildFrameRateSample,
  computeFps,
  formatFrameRateSample,
  meetsFrameBudget,
  msPerFrame,
  TARGET_FRAME_BUDGET_MS,
} from './frame-stats';

describe('computeFps', () => {
  it('구간 길이에서 초당 프레임 수를 낸다', () => {
    expect(computeFps(30, 1000)).toBe(30);
    expect(computeFps(15, 500)).toBe(30);
  });

  it('구간이 0 이하면 0을 반환한다(0으로 나누기 방지)', () => {
    expect(computeFps(30, 0)).toBe(0);
    expect(computeFps(30, -100)).toBe(0);
  });
});

describe('buildFrameRateSample', () => {
  it('fps를 소수 첫째 자리로 반올림한다', () => {
    const sample = buildFrameRateSample(29, 1000);
    expect(sample).toEqual({ frameCount: 29, elapsedMs: 1000, fps: 29 });

    expect(buildFrameRateSample(28, 999).fps).toBe(28);
  });
});

describe('msPerFrame', () => {
  it('프레임당 평균 처리 시간을 낸다', () => {
    expect(msPerFrame(buildFrameRateSample(30, 990))).toBe(33);
  });

  it('프레임이 없으면 0을 반환한다', () => {
    expect(msPerFrame(buildFrameRateSample(0, 1000))).toBe(0);
  });
});

describe('meetsFrameBudget', () => {
  it('33ms 이하면 목표를 만족한다', () => {
    expect(meetsFrameBudget(buildFrameRateSample(30, 990))).toBe(true);
    expect(meetsFrameBudget(buildFrameRateSample(60, 1000))).toBe(true);
  });

  it('33ms를 넘으면 만족하지 못한다', () => {
    expect(meetsFrameBudget(buildFrameRateSample(15, 1000))).toBe(false);
  });

  it('프레임이 하나도 없으면 만족으로 보지 않는다', () => {
    expect(meetsFrameBudget(buildFrameRateSample(0, 1000))).toBe(false);
  });

  it('예산을 직접 지정할 수 있다', () => {
    expect(meetsFrameBudget(buildFrameRateSample(15, 1000), 70)).toBe(true);
  });

  it('기본 예산은 사업계획서 목표인 33ms다', () => {
    expect(TARGET_FRAME_BUDGET_MS).toBe(33);
  });
});

describe('formatFrameRateSample', () => {
  it('로그로 확인하기 쉬운 문자열을 만든다', () => {
    expect(formatFrameRateSample(buildFrameRateSample(30, 1000))).toBe(
      '30 fps (30 frames / 1000ms, 33.3ms per frame)',
    );
  });
});
