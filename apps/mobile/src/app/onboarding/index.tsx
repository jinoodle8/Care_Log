import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** 최초 실행 시 진입하는 온보딩 화면. 두 경로 중 하나를 선택한다 (PRD 4.1.1).
 * 실제 회원가입/초대코드 발급·입력 로직은 M2에서 연결하고, 여기서는 각 플레이스홀더 화면으로만 이동한다. */
export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          CareLog
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          시작할 방법을 선택해 주세요
        </ThemedText>

        <Pressable
          style={styles.optionButton}
          onPress={() => router.push('/onboarding/guardian-start')}
        >
          <ThemedText type="subtitle" themeColor="text">
            보호자로 시작
          </ThemedText>
          <ThemedText type="small">회원가입하고 어르신 초대코드를 발급해요</ThemedText>
        </Pressable>

        <Pressable
          style={styles.optionButton}
          onPress={() => router.push('/onboarding/elder-setup')}
        >
          <ThemedText type="subtitle" themeColor="text">
            초대코드로 어르신 기기 설정
          </ThemedText>
          <ThemedText type="small">보호자가 어르신 기기를 대신 설정해요</ThemedText>
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
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 6,
  },
});
