import * as Notifications from 'expo-notifications';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api/push';
import { ensureNotificationPermission } from '@/features/elder/local-notifications';
import { useAuthStore } from '@/store/auth-store';
import { resolveProjectId } from './push-token';

/**
 * 로그인된 기기의 Expo 푸시 토큰을 서버에 등록한다(M3-04 누락분).
 *
 * 서버는 `User.pushToken`이 있는 대상에게만 푸시를 보내므로, 이 등록이 없으면
 * 복약 완료·미복용·수동확인 요청 푸시가 전부 조용히 버려진다.
 *
 * 실패는 앱 사용을 막지 않는다. 토큰 발급은 실기기에서만 되고(시뮬레이터·웹 불가),
 * 알림 권한을 거부하면 발급 자체가 되지 않는다.
 */
export function usePushTokenSync(): void {
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const sync = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    // 웹에는 Expo 푸시 토큰이 없다. 시뮬레이터는 아래 try/catch에서 걸러진다.
    if (Platform.OS === 'web') return;

    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn('[push] EAS projectId를 찾을 수 없어 푸시 토큰을 등록하지 못했습니다.');
      return;
    }

    try {
      if (!(await ensureNotificationPermission())) {
        console.warn('[push] 알림 권한이 없어 푸시 토큰을 등록하지 못했습니다.');
        return;
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(token);
      console.log('[push] 푸시 토큰 등록 완료:', token);
    } catch (error) {
      console.warn('[push] 푸시 토큰 등록 실패:', error);
    }
  }, [accessToken, isAuthLoaded]);

  useEffect(() => {
    void sync();
  }, [sync]);
}
