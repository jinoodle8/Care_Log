import type { Schedule } from '@carelog/shared';
import { buildNotificationPlan } from './notification-plan';

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sch-1',
    elderId: 'elder-1',
    slot: 'MORNING',
    time: '08:00',
    enabled: true,
    ...overrides,
  };
}

describe('buildNotificationPlan', () => {
  it('활성 스케줄을 시/분으로 분해한다', () => {
    const plan = buildNotificationPlan([schedule({ time: '08:30' })]);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ slot: 'MORNING', hour: 8, minute: 30 });
    expect(plan[0].title).toBe('약 드실 시간이에요');
    expect(plan[0].body).toContain('아침');
  });

  it('비활성 스케줄은 제외한다', () => {
    const plan = buildNotificationPlan([
      schedule({ id: 'a', enabled: false }),
      schedule({ id: 'b', slot: 'NOON', time: '12:30' }),
    ]);

    expect(plan).toHaveLength(1);
    expect(plan[0].slot).toBe('NOON');
  });

  it('시각이 이른 순서로 정렬한다', () => {
    const plan = buildNotificationPlan([
      schedule({ id: 'e', slot: 'EVENING', time: '19:00' }),
      schedule({ id: 'm', slot: 'MORNING', time: '08:00' }),
      schedule({ id: 'n', slot: 'NOON', time: '12:30' }),
    ]);

    expect(plan.map((item) => item.slot)).toEqual(['MORNING', 'NOON', 'EVENING']);
  });

  it('형식이 잘못된 시각은 건너뛴다', () => {
    const plan = buildNotificationPlan([schedule({ time: '25:00' }), schedule({ time: 'bad' })]);
    expect(plan).toHaveLength(0);
  });

  it('슬롯별로 알맞은 문구를 만든다', () => {
    const plan = buildNotificationPlan([
      schedule({ id: 'm', slot: 'MORNING', time: '08:00' }),
      schedule({ id: 'n', slot: 'NOON', time: '12:00' }),
      schedule({ id: 'e', slot: 'EVENING', time: '19:00' }),
    ]);

    expect(plan.map((item) => item.body)).toEqual([
      '아침 약 드실 시간이에요.',
      '점심 약 드실 시간이에요.',
      '저녁 약 드실 시간이에요.',
    ]);
  });

  it('복약 지도성 표현을 쓰지 않는다', () => {
    const plan = buildNotificationPlan([schedule()]);
    const forbidden = ['복용하세요', '처방', '치료', '진단'];

    for (const word of forbidden) {
      expect(plan[0].body).not.toContain(word);
      expect(plan[0].title).not.toContain(word);
    }
  });
});
