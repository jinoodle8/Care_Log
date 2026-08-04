import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLatestRecognitionResultStore } from '@/store/latest-recognition-result-store';

/** 결과 화면 플레이스홀더. TAKEN/UNCERTAIN/MISSED 메시지 분기와 Bounding Box 오버레이는
 * M2-08에서 구현한다. 여기서는 분석 결과가 정상적으로 전달됐는지만 확인한다. */
export default function ResultScreen() {
  const result = useLatestRecognitionResultStore((state) => state.result);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">결과: {result?.finalDecision ?? '알 수 없음'}</ThemedText>
        <ThemedText type="small">준비 중이에요 (M2-08에서 구현)</ThemedText>
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
    gap: 8,
  },
});
