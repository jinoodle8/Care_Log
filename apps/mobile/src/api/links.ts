import type { AuthTokens, CreateInviteCodeResponse, UserProfile } from '@carelog/shared';
import { apiClient } from './client';

export interface RedeemResult extends AuthTokens {
  elder: UserProfile;
  linkId: string;
}

export async function createInviteCode(): Promise<CreateInviteCodeResponse> {
  const response = await apiClient.post<CreateInviteCodeResponse>('/links/invite-code');
  return response.data;
}

/** 초대코드 자체가 권한이므로 인증 토큰 없이 호출한다(어르신 기기 최초 설정). */
export async function redeemInviteCode(params: {
  code: string;
  elderName: string;
  elderPhone: string;
}): Promise<RedeemResult> {
  const response = await apiClient.post<RedeemResult>('/links/redeem', params);
  return response.data;
}

export async function fetchMyElders(): Promise<UserProfile[]> {
  const response = await apiClient.get<UserProfile[]>('/users/me/elders');
  return response.data;
}
