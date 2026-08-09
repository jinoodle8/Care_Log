import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadLog } from '@/api/logs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { uploadRecordedVideo } from '@/features/elder/video-upload';
import { getRecognitionEngine } from '@/recognition';
import { useAuthStore } from '@/store/auth-store';
import { useLatestRecognitionResultStore } from '@/store/latest-recognition-result-store';
import { useRecognitionSettingsStore } from '@/store/recognition-settings-store';
import { useRecordedVideoStore } from '@/store/recorded-video-store';

/** 분석 중 화면(PRD 4.2.3). MockRecognitionEngine.analyze()를 호출해 결과를
 * useLatestRecognitionResultStore에 저장한 뒤 결과 화면으로 이동한다. 실패 시
 * 재시도 버튼을 제공한다(Mock 단계에서는 거의 발생하지 않지만 실서버 연동을 대비).
 * 판정 결과는 서버 로그로도 업로드하되(M2-11), 업로드 실패가 어르신의 결과 확인
 * 흐름을 막지 않도록 별도로 처리한다. */
export default function AnalyzingScreen() {
  const router = useRouter();
  const setResult = useLatestRecognitionResultStore((state) => state.setResult);

  const loadRecognitionSettings = useRecognitionSettingsStore((state) => state.load);
  const isRecognitionSettingsLoaded = useRecognitionSettingsStore((state) => state.isLoaded);
  const demoMode = useRecognitionSettingsStore((state) => state.demoMode);
  const takenRate = useRecognitionSettingsStore((state) => state.takenRate);
  const uncertainRate = useRecognitionSettingsStore((state) => state.uncertainRate);

  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const recordedUri = useRecordedVideoStore((state) => state.uri);
  const clearRecordedVideo = useRecordedVideoStore((state) => state.clear);

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void loadRecognitionSettings();
    void loadAuth();
  }, [loadRecognitionSettings, loadAuth]);

  const runAnalysis = useCallback(async () => {
    if (!isRecognitionSettingsLoaded || !isAuthLoaded) return;

    try {
      const engine = getRecognitionEngine({ demoMode, takenRate, uncertainRate });
      const result = await engine.analyze({ durationMs: 15000, demoMode });
      setResult(result);

      // elderId는 서버가 토큰에서 유도하므로, 연동이 끝난 기기(토큰 보유)에서만 업로드한다.
      if (accessToken) {
        // 영상은 S3로 직접 올리고 참조(videoRef)만 로그에 싣는다(M4-02).
        // 업로드가 실패해도 판정 기록 자체는 남겨야 하므로 videoRef 없이 진행한다.
        let videoRef: string | undefined;
        if (recordedUri) {
          try {
            videoRef = await uploadRecordedVideo(recordedUri);
          } catch (videoError) {
            console.warn('[analyzing] 영상 업로드 실패:', videoError);
          } finally {
            clearRecordedVideo();
          }
        }

        try {
          await uploadLog({
            takenAt: new Date().toISOString(),
            decision: result.finalDecision,
            sequenceConf: result.sequenceConf,
            detections: result.detections,
            actionSequence: result.actionSequence,
            videoRef,
          });
        } catch (uploadError) {
          console.warn('[analyzing] 로그 업로드 실패:', uploadError);
        }
      }

      router.replace('/elder/result');
    } catch {
      setHasError(true);
    }
  }, [
    accessToken,
    clearRecordedVideo,
    demoMode,
    isAuthLoaded,
    isRecognitionSettingsLoaded,
    recordedUri,
    router,
    setResult,
    takenRate,
    uncertainRate,
  ]);

  useEffect(() => {
    // runAnalysis의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              void runAnalysis();
            }}
          >
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
