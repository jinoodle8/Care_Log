import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** 어르신 홈 화면(PRD 4.2.1). 초대형 "약 먹기" 버튼 1개만 노출한다.
 * 버튼을 누르면 카메라 권한을 확인·요청하고, 허용되면 카운트다운 화면으로 이동한다. */
export default function ElderHomeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [deniedOnce, setDeniedOnce] = useState(false);

  const handlePress = async () => {
    if (permission?.granted) {
      router.push('/elder/countdown');
      return;
    }

    const result = await requestPermission();
    if (result.granted) {
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
    height: '60%',
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
  retryButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
});
