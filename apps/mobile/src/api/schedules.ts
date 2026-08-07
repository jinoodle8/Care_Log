import type { Schedule, ScheduleSlot } from '@carelog/shared';
import { apiClient } from './client';

export async function fetchSchedules(elderId: string): Promise<Schedule[]> {
  const response = await apiClient.get<Schedule[]>('/schedules', { params: { elderId } });
  return response.data;
}

export async function createSchedule(params: {
  elderId: string;
  slot: ScheduleSlot;
  time: string;
  enabled?: boolean;
}): Promise<Schedule> {
  const response = await apiClient.post<Schedule>('/schedules', params);
  return response.data;
}

export async function updateSchedule(
  id: string,
  params: { time?: string; enabled?: boolean },
): Promise<Schedule> {
  const response = await apiClient.patch<Schedule>(`/schedules/${id}`, params);
  return response.data;
}

export async function deleteSchedule(id: string): Promise<{ id: string }> {
  const response = await apiClient.delete<{ id: string }>(`/schedules/${id}`);
  return response.data;
}
