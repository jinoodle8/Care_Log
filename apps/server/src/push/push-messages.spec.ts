import { guardianPushForDecision, missedSchedulePush } from './push-messages';

describe('guardianPushForDecision', () => {
  it('TAKEN이면 복약 완료 알림을 만든다', () => {
    const payload = guardianPushForDecision('TAKEN', '박순자');
    expect(payload).toMatchObject({ title: '복약 완료' });
    expect(payload?.body).toContain('박순자');
    expect(payload?.data).toEqual({ type: 'log.taken' });
  });

  it('UNCERTAIN이면 수동확인 요청 알림을 만든다', () => {
    const payload = guardianPushForDecision('UNCERTAIN', '박순자');
    expect(payload).toMatchObject({ title: '확인이 필요해요' });
    expect(payload?.data).toEqual({ type: 'log.uncertain' });
  });

  it('MISSED는 로그 생성 경로에서 보내지 않는다(크론이 담당)', () => {
    expect(guardianPushForDecision('MISSED', '박순자')).toBeNull();
  });

  it('진단·복약 지도성 표현을 쓰지 않는다', () => {
    const forbidden = ['복용하세요', '처방', '치료', '진단', '드세요'];
    const bodies = [
      guardianPushForDecision('TAKEN', '박순자')?.body ?? '',
      guardianPushForDecision('UNCERTAIN', '박순자')?.body ?? '',
      missedSchedulePush('박순자').body,
    ];

    for (const body of bodies) {
      for (const word of forbidden) {
        expect(body).not.toContain(word);
      }
    }
  });
});

describe('missedSchedulePush', () => {
  it('미복용 감지 알림을 만든다', () => {
    const payload = missedSchedulePush('박순자');
    expect(payload.title).toBe('복약 기록이 없어요');
    expect(payload.body).toContain('박순자');
    expect(payload.data).toEqual({ type: 'schedule.missed' });
  });
});
