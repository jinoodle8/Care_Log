import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** 분석 중 화면 플레이스홀더. MockRecognitionEngine.analyze() 호출 및 로딩 UI는 M2-07에서 구현한다. */
export default function AnalyzingScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">확인하고 있어요...</ThemedText>
        <ThemedText type="small">준비 중이에요 (M2-07에서 구현)</ThemedText>
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
