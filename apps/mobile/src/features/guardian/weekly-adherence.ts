import type { MedicationLog } from '@carelog/shared';

export interface DayAdherence {
  /** 로컬 기준 날짜(YYYY-MM-DD) */
  date: string;
  weekdayLabel: string;
  takenCount: number;
  totalCount: number;
  /** 기록이 없는 날은 null(0%와 구분해 그래프에서 빈 막대로 표시). */
  adherenceRate: number | null;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 오늘을 마지막 날로 하는 최근 `days`일의 요일별 이행률을 만든다. */
export function buildWeeklyAdherence(logs: MedicationLog[], days = 7, now = new Date()): DayAdherence[] {
  const buckets = new Map<string, { taken: number; total: number }>();

  for (const log of logs) {
    const key = toLocalDateKey(new Date(log.takenAt));
    const bucket = buckets.get(key) ?? { taken: 0, total: 0 };
    bucket.total += 1;
    if (log.decision === 'TAKEN') bucket.taken += 1;
    buckets.set(key, bucket);
  }

  const result: DayAdherence[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = toLocalDateKey(date);
    const bucket = buckets.get(key);

    result.push({
      date: key,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      takenCount: bucket?.taken ?? 0,
      totalCount: bucket?.total ?? 0,
      adherenceRate: bucket && bucket.total > 0 ? bucket.taken / bucket.total : null,
    });
  }
  return result;
}

/** 일 단위 리스트를 최신순으로 정렬한다. */
export function sortLogsByRecent(logs: MedicationLog[]): MedicationLog[] {
  return [...logs].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
}
