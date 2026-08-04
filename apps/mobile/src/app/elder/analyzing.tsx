import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getRecognitionEngine } from '@/recognition';
import { useLatestRecognitionResultStore } from '@/store/latest-recognition-result-store';
import { useRecognitionSettingsStore } from '@/store/recognition-settings-store';

/** 분석 중 화면(PRD 4.2.3). MockRecognitionEngine.analyze()를 호출해 결과를
 * useLatestRecognitionResultStore에 저장한 뒤 결과 화면으로 이동한다. 실패 시
 * 재시도 버튼을 제공한다(Mock 단계에서는 거의 발생하지 않지만 실서버 연동을 대비). */
export default function AnalyzingScreen() {
  const router = useRouter();
  const setResult = useLatestRecognitionResultStore((state) => state.setResult);

  const loadRecognitionSettings = useRecognitionSettingsStore((state) => state.load);
  const isRecognitionSettingsLoaded = useRecognitionSettingsStore((state) => state.isLoaded);
  const demoMode = useRecognitionSettingsStore((state) => state.demoMode);
  const takenRate = useRecognitionSettingsStore((state) => state.takenRate);
  const uncertainRate = useRecognitionSettingsStore((state) => state.uncertainRate);

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void loadRecognitionSettings();
  }, [loadRecognitionSettings]);

  const runAnalysis = useCallback(async () => {
    if (!isRecognitionSettingsLoaded) return;

    setHasError(false);
    try {
      const engine = getRecognitionEngine({ demoMode, takenRate, uncertainRate });
      const result = await engine.analyze({ durationMs: 15000, demoMode });
      setResult(result);
      router.replace('/elder/result');
    } catch {
      setHasError(true);
    }
  }, [demoMode, isRecognitionSettingsLoaded, router, setResult, takenRate, uncertainRate]);

  useEffect(() => {
    void runAnalysis();
  }, [runAnalysis]);

  if (hasError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.centerText}>
            확인하지 못했어요
          </ThemedText>
          <ThemedText style={styles.centerText}>다시 시도해 주세요</ThemedText>
          <Pressable style={styles.retryButton} onPress={() => void runAnalysis()}>
            <ThemedText type="subtitle">다시 시도하기</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">확인하고 있어요...</ThemedText>
        <ActivityIndicator size="large" style={styles.spinner} />
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
    paddingHorizontal: 24,
  },
  spinner: {
    marginTop: 8,
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
    marginTop: 8,
  },
});
