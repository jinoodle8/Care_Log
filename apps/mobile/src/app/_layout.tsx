import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/features/elder/local-notifications';
import { usePushTokenSync } from '@/features/push/use-push-token-sync';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // 로그인된 기기의 푸시 토큰을 서버에 등록한다. 이게 없으면 서버가 보낼 대상을 모른다.
  usePushTokenSync();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // 복약 알림을 탭하면 바로 촬영을 시작할 수 있게 홈으로 보낸다(PRD 4.2.5).
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'schedule.reminder') {
        router.replace('/elder');
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
