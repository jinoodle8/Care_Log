import type { Role } from '../log';

export interface SignupRequest {
  name: string;
  phone: string;
  password: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  role: Role;
  name: string;
  phone: string;
}

export interface CreateInviteCodeResponse {
  code: string;
  expiresAt: string;
}

export interface RedeemInviteCodeRequest {
  code: string;
  elderName: string;
}

export interface PresignMediaRequest {
  contentType: string;
}

export interface PresignMediaResponse {
  uploadUrl: string;
  videoRef: string;
  expiresAt: string;
}

/** 서버 공통 에러 응답 포맷 (TRD 5.4) */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
}
