import type { MedicationLog } from '@carelog/shared';
import { buildWeeklyAdherence, sortLogsByRecent } from './weekly-adherence';

function buildLog(takenAt: Date, decision: MedicationLog['decision']): MedicationLog {
  const iso = takenAt.toISOString();
  return {
    id: `log-${iso}-${decision}`,
    elderId: 'elder-1',
    takenAt: iso,
    decision,
    sequenceConf: 0.95,
    detections: [],
    actionSequence: [],
    createdAt: iso,
  };
}

function daysAgo(days: number, hour = 9): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

describe('buildWeeklyAdherence', () => {
  it('최근 7일치를 과거→오늘 순서로 반환한다', () => {
    const result = buildWeeklyAdherence([]);
    expect(result).toHaveLength(7);

    const dates = result.map((day) => day.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('기록이 없는 날은 이행률이 null이다', () => {
    const result = buildWeeklyAdherence([]);
    expect(result.every((day) => day.adherenceRate === null)).toBe(true);
    expect(result.every((day) => day.totalCount === 0)).toBe(true);
  });

  it('하루에 TAKEN 3건 중 4건이면 75%를 계산한다', () => {
    const logs = [
      buildLog(daysAgo(1, 8), 'TAKEN'),
      buildLog(daysAgo(1, 12), 'TAKEN'),
      buildLog(daysAgo(1, 18), 'TAKEN'),
      buildLog(daysAgo(1, 20), 'MISSED'),
    ];

    const target = buildWeeklyAdherence(logs).find((day) => day.totalCount > 0);
    expect(target).toMatchObject({ takenCount: 3, totalCount: 4, adherenceRate: 0.75 });
  });

  it('여러 날에 걸친 기록을 각 날짜로 분리한다', () => {
    const logs = [buildLog(daysAgo(2), 'TAKEN'), buildLog(daysAgo(0), 'MISSED')];
    const filled = buildWeeklyAdherence(logs).filter((day) => day.totalCount > 0);

    expect(filled).toHaveLength(2);
    expect(filled[0].adherenceRate).toBe(1);
    expect(filled[1].adherenceRate).toBe(0);
  });
});

describe('sortLogsByRecent', () => {
  it('최신 기록이 앞에 오도록 정렬한다', () => {
    const older = buildLog(daysAgo(2), 'TAKEN');
    const newer = buildLog(daysAgo(0), 'MISSED');

    const sorted = sortLogsByRecent([older, newer]);
    expect(sorted[0].id).toBe(newer.id);
    expect(sorted[1].id).toBe(older.id);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const logs = [buildLog(daysAgo(2), 'TAKEN'), buildLog(daysAgo(0), 'MISSED')];
    const original = [...logs];
    sortLogsByRecent(logs);
    expect(logs).toEqual(original);
  });
});
