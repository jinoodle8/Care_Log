import axios, { type AxiosError } from 'axios';

interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.code = response.code;
    this.statusCode = response.statusCode;
  }
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null && typeof (data as { code?: unknown }).code === 'string';
}

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 10000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // TODO(M2-14/M2-15): 401 응답 시 리프레시 토큰으로 1회 재시도 후 실패하면 로그아웃 처리한다.
    if (isApiErrorResponse(error.response?.data)) {
      return Promise.reject(new ApiError(error.response.data));
    }
    return Promise.reject(error);
  },
);
