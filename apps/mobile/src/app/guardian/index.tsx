import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** 보호자 모드 대시보드 뼈대. 실제 대시보드 UI는 M2-16에서 구현한다.
 * 개발자 설정(Mock 인식 엔진 QA용)은 임시로 여기서 진입할 수 있게 둔다. */
export default function GuardianDashboardScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">보호자 모드</ThemedText>
        <Pressable style={styles.devLink} onPress={() => router.push('/dev/recognition-settings')}>
          <ThemedText type="link">개발자 설정 (QA)</ThemedText>
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
    gap: 16,
  },
  devLink: {
    padding: 8,
  },
});
