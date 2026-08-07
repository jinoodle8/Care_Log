import type { ScheduleSlot } from '@carelog/shared';

export const SLOT_ORDER: ScheduleSlot[] = ['MORNING', 'NOON', 'EVENING'];

export const SLOT_LABELS: Record<ScheduleSlot, string> = {
  MORNING: '아침',
  NOON: '점심',
  EVENING: '저녁',
};

/** 슬롯별 기본 시각. 보호자가 새 스케줄을 만들 때 시작값으로 쓴다. */
export const DEFAULT_SLOT_TIME: Record<ScheduleSlot, string> = {
  MORNING: '08:00',
  NOON: '12:30',
  EVENING: '19:00',
};

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/** "HH:mm"에 분 단위로 가감한다. 자정을 넘으면 24시간 안에서 순환한다. */
export function shiftTime(time: string, deltaMinutes: number): string {
  if (!isValidTime(time)) return time;

  const [hours, minutes] = time.split(':').map(Number);
  const total = (((hours * 60 + minutes + deltaMinutes) % 1440) + 1440) % 1440;
  const nextHours = String(Math.floor(total / 60)).padStart(2, '0');
  const nextMinutes = String(total % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

/** "08:30" → "오전 8:30" 처럼 사람이 읽기 쉬운 형태로 바꾼다. */
export function formatTimeLabel(time: string): string {
  if (!isValidTime(time)) return time;

  const [hours, minutes] = time.split(':').map(Number);
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
}
