import type { AuthTokens, UserProfile } from '@carelog/shared';
import { apiClient } from './client';

export interface AuthResult extends AuthTokens {
  user: UserProfile;
}

export async function signup(params: {
  name: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const response = await apiClient.post<AuthResult>('/auth/signup', params);
  return response.data;
}

export async function login(params: { phone: string; password: string }): Promise<AuthResult> {
  const response = await apiClient.post<AuthResult>('/auth/login', params);
  return response.data;
}
