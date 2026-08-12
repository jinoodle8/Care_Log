import type { MedicationLog } from '@carelog/shared';

import {
  buildElderHistory,
  describeDecisionForElder,
  formatDateLabel,
  historyFromIso,
} from './medication-history';

function log(overrides: Partial<MedicationLog> & { takenAt: string }): MedicationLog {
  return {
    id: overrides.id ?? `log-${overrides.takenAt}`,
    elderId: 'elder-1',
    scheduleId: null,
    decision: 'TAKEN',
    sequenceConf: 0.95,
    detections: [],
    actionSequence: [],
    videoRef: null,
    manualConfirmedBy: null,
    manualConfirmedAt: null,
    deviceInfo: null,
    createdAt: overrides.takenAt,
    ...overrides,
  };
}

describe('describeDecisionForElder', () => {
  it('판정을 부드러운 문구로 바꾼다', () => {
    expect(describeDecisionForElder('TAKEN')).toBe('드셨어요');
    expect(describeDecisionForElder('UNCERTAIN')).toBe('확인 중이에요');
    expect(describeDecisionForElder('MISSED')).toBe('기록이 없어요');
  });

  it('질책성·진단성 표현을 쓰지 않는다', () => {
    const forbidden = ['거르', '위험', '복용하세요', '처방', '치료', '진단', '실패'];
    for (const decision of ['TAKEN', 'UNCERTAIN', 'MISSED'] as const) {
      const text = describeDecisionForElder(decision);
      for (const word of forbidden) {
        expect(text).not.toContain(word);
      }
    }
  });
});

describe('formatDateLabel', () => {
  const now = new Date(2026, 7, 13, 10, 0);

  it('오늘과 어제는 말로 표시한다', () => {
    expect(formatDateLabel(new Date(2026, 7, 13, 8, 0), now)).toBe('오늘');
    expect(formatDateLabel(new Date(2026, 7, 12, 22, 0), now)).toBe('어제');
  });

  it('그 이전은 월/일로 표시한다', () => {
    expect(formatDateLabel(new Date(2026, 7, 11, 8, 0), now)).toBe('8월 11일');
    expect(formatDateLabel(new Date(2026, 6, 30, 8, 0), now)).toBe('7월 30일');
  });

  it('같은 날이면 시각이 달라도 오늘이다', () => {
    expect(formatDateLabel(new Date(2026, 7, 13, 23, 59), now)).toBe('오늘');
    expect(formatDateLabel(new Date(2026, 7, 13, 0, 1), now)).toBe('오늘');
  });
});

describe('buildElderHistory', () => {
  const now = new Date(2026, 7, 13, 20, 0);

  it('날짜별로 묶고 최신 날짜가 먼저 온다', () => {
    const history = buildElderHistory(
      [
        log({ takenAt: new Date(2026, 7, 11, 8, 0).toISOString() }),
        log({ takenAt: new Date(2026, 7, 13, 8, 0).toISOString() }),
        log({ takenAt: new Date(2026, 7, 12, 8, 0).toISOString() }),
      ],
      now,
    );

    expect(history.map((day) => day.dateLabel)).toEqual([
      '오늘',
      '어제',
      '8월 11일',
    ]);
  });

  it('같은 날 여러 건은 최신순으로 담는다', () => {
    const history = buildElderHistory(
      [
        log({ id: 'a', takenAt: new Date(2026, 7, 13, 8, 0).toISOString() }),
        log({ id: 'b', takenAt: new Date(2026, 7, 13, 19, 0).toISOString() }),
        log({ id: 'c', takenAt: new Date(2026, 7, 13, 12, 30).toISOString() }),
      ],
      now,
    );

    expect(history).toHaveLength(1);
    expect(history[0].entries.map((e) => e.logId)).toEqual(['b', 'c', 'a']);
    expect(history[0].entries.map((e) => e.slotLabel)).toEqual([
      '저녁',
      '점심',
      '아침',
    ]);
  });

  it('판정별 문구를 붙인다', () => {
    const history = buildElderHistory(
      [
        log({ takenAt: new Date(2026, 7, 13, 8, 0).toISOString(), decision: 'TAKEN' }),
        log({
          id: 'u',
          takenAt: new Date(2026, 7, 13, 12, 0).toISOString(),
          decision: 'UNCERTAIN',
        }),
        log({
          id: 'm',
          takenAt: new Date(2026, 7, 13, 19, 0).toISOString(),
          decision: 'MISSED',
        }),
      ],
      now,
    );

    expect(history[0].entries.map((e) => e.statusLabel)).toEqual([
      '기록이 없어요',
      '확인 중이에요',
      '드셨어요',
    ]);
  });

  it('기록이 없으면 빈 배열을 반환한다', () => {
    expect(buildElderHistory([], now)).toEqual([]);
  });
});

describe('historyFromIso', () => {
  it('오늘 포함 7일치를 보도록 6일 전 자정을 반환한다', () => {
    const from = new Date(historyFromIso(new Date(2026, 7, 13, 20, 0)));
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(7);
    expect(from.getDate()).toBe(7);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
  });
});
