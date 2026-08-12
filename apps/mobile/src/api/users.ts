import type { UserProfile } from '@carelog/shared';
import { apiClient } from './client';

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/users/me');
  return response.data;
}

/** 내 이름·전화번호 수정 (M7-01) */
export async function updateMyProfile(
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  const response = await apiClient.patch<UserProfile>('/users/me', payload);
  return response.data;
}

/** 비밀번호 변경 (M7-02) */
export async function changeMyPassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post('/users/me/password', params);
}

/** 보호자가 연동된 어르신 정보를 대신 수정 (M7-03) */
export async function updateElderProfile(
  elderId: string,
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  const response = await apiClient.patch<UserProfile>(
    `/users/elders/${elderId}`,
    payload,
  );
  return response.data;
}
