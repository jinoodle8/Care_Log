import type { ScheduleSlot } from '@carelog/shared';

/** 감지에 필요한 최소 스케줄 정보 */
export interface ScheduleLike {
  id: string;
  elderId: string;
  slot: ScheduleSlot;
  /** "HH:mm" */
  time: string;
  enabled: boolean;
}

/** 감지에 필요한 최소 로그 정보 */
export interface LogLike {
  elderId: string;
  takenAt: Date;
}

export interface MissedTarget {
  scheduleId: string;
  elderId: string;
  slot: ScheduleSlot;
  /** 놓친 것으로 판단한 예정 시각 */
  scheduledAt: Date;
}

/** 예정 시각보다 이만큼 일찍 복용해도 해당 스케줄을 지킨 것으로 본다. */
const EARLY_WINDOW_MINUTES = 60;

/** "HH:mm"을 기준일(now)의 같은 날짜에 대입해 Date로 만든다. */
export function scheduledDateFor(time: string, now: Date): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * 스케줄 시각 +graceMinutes가 지났는데 그 시간대의 복약 로그가 없는 건을 골라낸다.
 * 로그 판정 창은 [예정시각 - 60분, 예정시각 + graceMinutes]이며, 이 안에 로그가
 * 하나라도 있으면 지킨 것으로 본다(판정 결과와 무관 — 시도 자체가 있었으므로).
 */
export function resolveMissedSchedules(params: {
  schedules: ScheduleLike[];
  logs: LogLike[];
  now: Date;
  graceMinutes: number;
}): MissedTarget[] {
  const { schedules, logs, now, graceMinutes } = params;
  const targets: MissedTarget[] = [];

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;

    const scheduledAt = scheduledDateFor(schedule.time, now);
    const deadline = new Date(scheduledAt.getTime() + graceMinutes * 60_000);
    if (now < deadline) continue;

    const windowStart = new Date(
      scheduledAt.getTime() - EARLY_WINDOW_MINUTES * 60_000,
    );
    const hasLog = logs.some(
      (log) =>
        log.elderId === schedule.elderId &&
        log.takenAt >= windowStart &&
        log.takenAt <= deadline,
    );
    if (hasLog) continue;

    targets.push({
      scheduleId: schedule.id,
      elderId: schedule.elderId,
      slot: schedule.slot,
      scheduledAt,
    });
  }

  return targets;
}
