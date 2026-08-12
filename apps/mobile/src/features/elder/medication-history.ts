import type { Decision, MedicationLog } from '@carelog/shared';

import { resolveSlot } from '@/features/guardian/today-slots';

export interface ElderHistoryEntry {
  logId: string;
  /** "아침" / "점심" / "저녁" */
  slotLabel: string;
  /** "드셨어요" / "확인 중이에요" / "기록이 없어요" */
  statusLabel: string;
  takenAt: string;
}

export interface ElderHistoryDay {
  /** 정렬·키 용도의 YYYY-MM-DD */
  dateKey: string;
  /** "오늘" / "어제" / "8월 12일" */
  dateLabel: string;
  entries: ElderHistoryEntry[];
}

const SLOT_LABELS = {
  MORNING: '아침',
  NOON: '점심',
  EVENING: '저녁',
} as const;

/**
 * 어르신에게 보여줄 문구. 보호자 화면(`describeDecision`)보다 부드럽게 쓴다.
 * 질책·진단으로 읽힐 표현은 쓰지 않는다(PRD 4.2.6, CLAUDE.md 7장).
 */
export function describeDecisionForElder(decision: Decision): string {
  switch (decision) {
    case 'TAKEN':
      return '드셨어요';
    case 'UNCERTAIN':
      return '확인 중이에요';
    case 'MISSED':
      return '기록이 없어요';
  }
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 기기 로케일에 흔들리지 않도록 직접 만든다. 어제·오늘은 날짜 대신 말로 보여준다. */
export function formatDateLabel(date: Date, now: Date): string {
  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return '오늘';
  if (dayDiff === 1) return '어제';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * 어르신 복약 기록을 날짜별로 묶어 최신순으로 정리한다(PRD 4.2.6).
 * 통계·그래프 없이 "언제 어떻게 됐는지"만 남긴다.
 */
export function buildElderHistory(
  logs: MedicationLog[],
  now: Date = new Date(),
): ElderHistoryDay[] {
  const byDate = new Map<string, ElderHistoryDay>();

  const sorted = [...logs].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  for (const log of sorted) {
    const date = new Date(log.takenAt);
    const dateKey = toDateKey(date);

    let day = byDate.get(dateKey);
    if (!day) {
      day = {
        dateKey,
        dateLabel: formatDateLabel(date, now),
        entries: [],
      };
      byDate.set(dateKey, day);
    }

    day.entries.push({
      logId: log.id,
      slotLabel: SLOT_LABELS[resolveSlot(log.takenAt)],
      statusLabel: describeDecisionForElder(log.decision),
      takenAt: log.takenAt,
    });
  }

  return [...byDate.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/** 조회 시작 시각(최근 7일). 오늘 포함이라 6일 전 00:00부터 본다. */
export function historyFromIso(now: Date = new Date()): string {
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return from.toISOString();
}
