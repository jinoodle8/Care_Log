import type { Schedule, ScheduleSlot } from '@carelog/shared';

export interface NotificationPlanItem {
  slot: ScheduleSlot;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

const SLOT_LABELS: Record<ScheduleSlot, string> = {
  MORNING: '아침',
  NOON: '점심',
  EVENING: '저녁',
};

/** 어르신에게 보여줄 알림 문구. 비의료 서비스이므로 복약 지도성 표현은 쓰지 않는다(CLAUDE.md 7장). */
function bodyFor(slot: ScheduleSlot): string {
  return `${SLOT_LABELS[slot]} 약 드실 시간이에요.`;
}

/**
 * 활성화된 스케줄만 매일 반복 알림 계획으로 바꾼다.
 * 시각이 이르면 먼저 오도록 정렬해, 알림 등록 순서가 하루 흐름과 같게 한다.
 */
export function buildNotificationPlan(schedules: Schedule[]): NotificationPlanItem[] {
  return schedules
    .filter((schedule) => schedule.enabled && isValidTime(schedule.time))
    .map((schedule) => {
      const [hour, minute] = schedule.time.split(':').map(Number);
      return {
        slot: schedule.slot,
        hour,
        minute,
        title: '약 드실 시간이에요',
        body: bodyFor(schedule.slot),
      };
    })
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
