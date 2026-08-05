import type { MedicationLog } from '@carelog/shared';
import { resolveSlot, summarizeTodaySlots } from './today-slots';

function buildLog(takenAt: string, decision: MedicationLog['decision']): MedicationLog {
  return {
    id: `log-${takenAt}`,
    elderId: 'elder-1',
    takenAt,
    decision,
    sequenceConf: 0.95,
    detections: [],
    actionSequence: [],
    createdAt: takenAt,
  };
}

/** 로컬 타임존 기준 시각으로 ISO 문자열을 만든다(테스트가 타임존에 흔들리지 않도록). */
function localIso(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

describe('resolveSlot', () => {
  it('11시 이전은 아침, 17시 이전은 점심, 그 이후는 저녁으로 나눈다', () => {
    expect(resolveSlot(localIso(8))).toBe('MORNING');
    expect(resolveSlot(localIso(10))).toBe('MORNING');
    expect(resolveSlot(localIso(11))).toBe('NOON');
    expect(resolveSlot(localIso(16))).toBe('NOON');
    expect(resolveSlot(localIso(17))).toBe('EVENING');
    expect(resolveSlot(localIso(21))).toBe('EVENING');
  });
});

describe('summarizeTodaySlots', () => {
  it('로그가 없으면 세 시간대 모두 기록 없음(null)으로 반환한다', () => {
    const summaries = summarizeTodaySlots([]);
    expect(summaries).toHaveLength(3);
    expect(summaries.map((s) => s.slot)).toEqual(['MORNING', 'NOON', 'EVENING']);
    expect(summaries.every((s) => s.decision === null)).toBe(true);
  });

  it('시간대별로 로그의 판정을 매핑한다', () => {
    const summaries = summarizeTodaySlots([
      buildLog(localIso(8), 'TAKEN'),
      buildLog(localIso(13), 'UNCERTAIN'),
    ]);

    expect(summaries[0]).toMatchObject({ slot: 'MORNING', decision: 'TAKEN' });
    expect(summaries[1]).toMatchObject({ slot: 'NOON', decision: 'UNCERTAIN' });
    expect(summaries[2]).toMatchObject({ slot: 'EVENING', decision: null });
  });

  it('같은 시간대에 여러 건이면 가장 최근 기록을 대표로 삼는다', () => {
    const summaries = summarizeTodaySlots([
      buildLog(localIso(8), 'MISSED'),
      buildLog(localIso(10), 'TAKEN'),
    ]);

    expect(summaries[0]).toMatchObject({ slot: 'MORNING', decision: 'TAKEN' });
  });
});
