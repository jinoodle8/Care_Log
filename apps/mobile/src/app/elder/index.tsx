import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';

import { fetchSchedules } from '@/api/schedules';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { syncMedicationReminders } from '@/features/elder/local-notifications';
import { useAuthStore } from '@/store/auth-store';

/** 어르신 홈 화면(PRD 4.2.1). 초대형 "약 먹기" 버튼 1개만 노출한다.
 * 버튼을 누르면 카메라 권한을 확인·요청하고, 허용되면 카운트다운 화면으로 이동한다.
 * 화면에 들어올 때마다 보호자가 설정한 스케줄로 로컬 알림을 맞춘다(PRD 4.2.5). */
export default function ElderHomeScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [deniedOnce, setDeniedOnce] = useState(false);

  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const syncReminders = useCallback(async () => {
    if (!isAuthLoaded || !accessToken || !user) return;

    try {
      await syncMedicationReminders(await fetchSchedules(user.id));
    } catch (error) {
      // 알림 동기화 실패가 촬영을 막지 않도록 조용히 넘어간다.
      console.warn('[elder] 복약 알림 동기화 실패:', error);
    }
  }, [accessToken, isAuthLoaded, user]);

  useEffect(() => {
    void syncReminders();
  }, [syncReminders]);

  const handlePress = async () => {
    if (hasPermission) {
      router.push('/elder/countdown');
      return;
    }

    const granted = await requestPermission();
    if (granted) {
      setDeniedOnce(false);
      router.push('/elder/countdown');
    } else {
      setDeniedOnce(true);
    }
  };

  if (deniedOnce) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.centerText}>
            카메라 권한이 필요해요
          </ThemedText>
          <ThemedText style={styles.centerText}>휴대폰 설정에서 카메라 권한을 허용해 주세요</ThemedText>
          <Pressable style={styles.retryButton} onPress={() => void handlePress()}>
            <ThemedText type="subtitle">다시 시도하기</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable style={styles.bigButton} onPress={() => void handlePress()}>
          <ThemedText type="title" themeColor="background" style={styles.bigButtonText}>
            약 먹기
          </ThemedText>
        </Pressable>

        {/* 보조 동작. "약 먹기"보다 작게 두어 홈의 초점이 흐려지지 않게 한다(PRD 4.2.6). */}
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/elder/history')}>
          <ThemedText type="subtitle" style={styles.secondaryText}>
            내 복약 기록
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  bigButton: {
    width: '80%',
    height: '52%',
    minHeight: 240,
    borderRadius: 32,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: {
    textAlign: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#D0D5DD',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  secondaryText: {
    fontSize: 24,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
});
