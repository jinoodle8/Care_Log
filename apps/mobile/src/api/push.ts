import { apiClient } from './client';

/** 이 기기의 Expo 푸시 토큰을 내 계정에 등록한다. 서버는 이 토큰으로만 푸시를 보낸다. */
export async function registerPushToken(pushToken: string): Promise<void> {
  await apiClient.post('/users/me/push-token', { pushToken });
}
