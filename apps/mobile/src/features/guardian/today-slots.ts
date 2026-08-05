import type { Decision, MedicationLog, ScheduleSlot } from '@carelog/shared';

export interface SlotSummary {
  slot: ScheduleSlot;
  label: string;
  /** 해당 시간대의 대표 판정. 로그가 없으면 null(예정/기록 없음). */
  decision: Decision | null;
  takenAt: string | null;
}

const SLOT_LABELS: Record<ScheduleSlot, string> = {
  MORNING: '아침',
  NOON: '점심',
  EVENING: '저녁',
};

/** 스케줄 CRUD(M3-01) 전까지는 시각으로 시간대를 나눈다: ~11시 아침, ~17시 점심, 그 이후 저녁. */
export function resolveSlot(takenAt: string): ScheduleSlot {
  const hour = new Date(takenAt).getHours();
  if (hour < 11) return 'MORNING';
  if (hour < 17) return 'NOON';
  return 'EVENING';
}

/** 같은 시간대에 여러 건이 있으면 가장 최근 기록을 대표로 삼는다. */
export function summarizeTodaySlots(logs: MedicationLog[]): SlotSummary[] {
  const slots: ScheduleSlot[] = ['MORNING', 'NOON', 'EVENING'];
  const latestBySlot = new Map<ScheduleSlot, MedicationLog>();

  for (const log of logs) {
    const slot = resolveSlot(log.takenAt);
    const current = latestBySlot.get(slot);
    if (!current || new Date(log.takenAt) > new Date(current.takenAt)) {
      latestBySlot.set(slot, log);
    }
  }

  return slots.map((slot) => {
    const log = latestBySlot.get(slot);
    return {
      slot,
      label: SLOT_LABELS[slot],
      decision: log?.decision ?? null,
      takenAt: log?.takenAt ?? null,
    };
  });
}

export function describeDecision(decision: Decision | null): string {
  switch (decision) {
    case 'TAKEN':
      return '복약 완료';
    case 'UNCERTAIN':
      return '확인 필요';
    case 'MISSED':
      return '미복용';
    default:
      return '기록 없음';
  }
}

export function decisionColor(decision: Decision | null): string {
  switch (decision) {
    case 'TAKEN':
      return '#22C55E';
    case 'UNCERTAIN':
      return '#F59E0B';
    case 'MISSED':
      return '#DC2626';
    default:
      return '#9CA3AF';
  }
}
