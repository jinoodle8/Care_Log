import type { Decision } from '@carelog/shared';
import type { PushPayload } from './push.service';

/**
 * 판정 결과에 대응하는 보호자 알림 문구. 비의료 서비스이므로 진단·복약 지도성 표현은
 * 쓰지 않고 "무슨 일이 있었는지"만 알린다(CLAUDE.md 7장).
 * MISSED는 복약 로그가 아니라 미복용 감지 크론에서 별도 문구로 보낸다.
 */
export function guardianPushForDecision(
  decision: Decision,
  elderName: string,
): PushPayload | null {
  switch (decision) {
    case 'TAKEN':
      return {
        title: '복약 완료',
        body: `${elderName} 어르신이 약을 드셨어요.`,
        data: { type: 'log.taken' },
      };
    case 'UNCERTAIN':
      return {
        title: '확인이 필요해요',
        body: `${elderName} 어르신의 복약을 확인해 주세요.`,
        data: { type: 'log.uncertain' },
      };
    default:
      return null;
  }
}

/** 스케줄 시각이 지나도록 기록이 없을 때 보내는 알림(M3-06). */
export function missedSchedulePush(elderName: string): PushPayload {
  return {
    title: '복약 기록이 없어요',
    body: `${elderName} 어르신의 복약 기록이 아직 없어요.`,
    data: { type: 'schedule.missed' },
  };
}
