import {
  resolveMissedSchedules,
  scheduledDateFor,
  type LogLike,
  type ScheduleLike,
} from './missed-detection';

const GRACE = 30;

function at(hours: number, minutes = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function schedule(overrides: Partial<ScheduleLike> = {}): ScheduleLike {
  return {
    id: 'sch-1',
    elderId: 'elder-1',
    slot: 'MORNING',
    time: '08:00',
    enabled: true,
    ...overrides,
  };
}

function log(takenAt: Date, elderId = 'elder-1'): LogLike {
  return { elderId, takenAt };
}

describe('scheduledDateFor', () => {
  it('"HH:mm"을 기준일의 같은 날짜 시각으로 만든다', () => {
    const result = scheduledDateFor('08:30', at(15));
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('resolveMissedSchedules', () => {
  it('유예 시간이 지나지 않았으면 감지하지 않는다', () => {
    // 08:00 예정 + 30분 유예 → 08:30부터 감지. 현재 08:29.
    const targets = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [],
      now: at(8, 29),
      graceMinutes: GRACE,
    });
    expect(targets).toHaveLength(0);
  });

  it('유예 시간이 지났고 로그가 없으면 감지한다', () => {
    const targets = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [],
      now: at(8, 30),
      graceMinutes: GRACE,
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      scheduleId: 'sch-1',
      elderId: 'elder-1',
      slot: 'MORNING',
    });
    expect(targets[0].scheduledAt.getHours()).toBe(8);
  });

  it('유예 창 안에 로그가 있으면 감지하지 않는다', () => {
    const targets = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [log(at(8, 10))],
      now: at(9),
      graceMinutes: GRACE,
    });
    expect(targets).toHaveLength(0);
  });

  it('예정 시각보다 일찍(60분 이내) 복용해도 지킨 것으로 본다', () => {
    const targets = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [log(at(7, 15))],
      now: at(9),
      graceMinutes: GRACE,
    });
    expect(targets).toHaveLength(0);
  });

  it('창 밖(너무 이른/늦은) 로그는 그 스케줄을 지킨 것으로 보지 않는다', () => {
    const tooEarly = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [log(at(6, 30))],
      now: at(9),
      graceMinutes: GRACE,
    });
    expect(tooEarly).toHaveLength(1);

    const tooLate = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [log(at(8, 45))],
      now: at(9),
      graceMinutes: GRACE,
    });
    expect(tooLate).toHaveLength(1);
  });

  it('비활성(enabled=false) 스케줄은 감지하지 않는다', () => {
    const targets = resolveMissedSchedules({
      schedules: [schedule({ enabled: false })],
      logs: [],
      now: at(12),
      graceMinutes: GRACE,
    });
    expect(targets).toHaveLength(0);
  });

  it('다른 어르신의 로그는 대신 인정되지 않는다', () => {
    const targets = resolveMissedSchedules({
      schedules: [schedule()],
      logs: [log(at(8, 10), 'elder-2')],
      now: at(9),
      graceMinutes: GRACE,
    });
    expect(targets).toHaveLength(1);
  });

  it('여러 슬롯 중 지나간 것만 골라낸다', () => {
    const schedules = [
      schedule({ id: 'm', slot: 'MORNING', time: '08:00' }),
      schedule({ id: 'n', slot: 'NOON', time: '12:30' }),
      schedule({ id: 'e', slot: 'EVENING', time: '19:00' }),
    ];

    // 13:10 → 아침(08:30~)과 점심(13:00~)은 지났고 저녁은 아직.
    const targets = resolveMissedSchedules({
      schedules,
      logs: [],
      now: at(13, 10),
      graceMinutes: GRACE,
    });

    expect(targets.map((t) => t.scheduleId)).toEqual(['m', 'n']);
  });
});
