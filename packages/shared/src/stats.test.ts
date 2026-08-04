import { describe, expect, it } from 'vitest';
import { calculateLogStats } from './stats';

describe('calculateLogStats', () => {
  it('스케줄 4건 중 TAKEN 3건이면 이행률 75%를 반환한다', () => {
    const stats = calculateLogStats(['TAKEN', 'TAKEN', 'TAKEN', 'UNCERTAIN'], 'day');

    expect(stats).toEqual({
      range: 'day',
      takenCount: 3,
      uncertainCount: 1,
      missedCount: 0,
      scheduledCount: 4,
      adherenceRate: 0.75,
    });
  });

  it('로그가 없으면 이행률 0을 반환하고 0으로 나누지 않는다', () => {
    const stats = calculateLogStats([], 'week');
    expect(stats.scheduledCount).toBe(0);
    expect(stats.adherenceRate).toBe(0);
  });

  it('MISSED만 있으면 이행률 0%를 반환한다', () => {
    const stats = calculateLogStats(['MISSED', 'MISSED'], 'day');
    expect(stats.adherenceRate).toBe(0);
    expect(stats.missedCount).toBe(2);
  });

  it('전부 TAKEN이면 이행률 100%를 반환한다', () => {
    const stats = calculateLogStats(['TAKEN', 'TAKEN'], 'week');
    expect(stats.adherenceRate).toBe(1);
  });
});
