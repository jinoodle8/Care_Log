import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraPermission,
  useVideoOutput,
} from 'react-native-vision-camera';
import type { Recorder } from 'react-native-vision-camera';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFramePipeline } from '@/features/elder/use-frame-pipeline';
import { toFileUrl } from '@/features/elder/video-upload';
import { useRecordedVideoStore } from '@/store/recorded-video-store';

const MAX_RECORDING_SECONDS = 15;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;

/** 녹화 화면(PRD 4.2.2). 최대 15초 자동 녹화 후 분석 중 화면으로 이동한다. 화면에는
 * "촬영 중" 표시와 취소(뒤로가기) 옵션만 존재한다.
 *
 * M5-02에서 expo-camera → react-native-vision-camera로 교체했다. 녹화 동작은
 * 그대로이고, 같은 세션에 frame processor 출력(M5-01)을 함께 붙여 M6에서 온디바이스
 * 추론을 넣을 자리를 미리 열어 뒀다. 지금 frame processor는 프레임 수만 센다. */
export default function RecordingScreen() {
  const router = useRouter();
  const { hasPermission } = useCameraPermission();
  const setRecordedUri = useRecordedVideoStore((state) => state.setUri);

  const videoOutput = useVideoOutput({ enableAudio: false });
  const { frameOutput } = useFramePipeline({ enabled: hasPermission });

  const recorderRef = useRef<Recorder | null>(null);
  const hasLeftRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  /** 녹화 결과가 나오든 실패하든 분석 화면으로는 반드시 한 번만 넘어간다. */
  const leaveToAnalyzing = useCallback(
    (filePath: string | null) => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;
      // Recorder는 file:// 없는 파일시스템 경로를 준다. 업로드 계층은 URL을 기대한다.
      setRecordedUri(filePath ? toFileUrl(filePath) : null);
      router.replace('/elder/analyzing');
    },
    [router, setRecordedUri],
  );

  useEffect(() => {
    if (!hasPermission) return;

    // 직전 촬영의 URI가 남아 잘못 업로드되는 일이 없도록 매번 비우고 시작한다.
    setRecordedUri(null);
    hasLeftRef.current = false;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      try {
        const recorder = await videoOutput.createRecorder({
          maxDuration: MAX_RECORDING_SECONDS,
        });
        if (cancelled) return;
        recorderRef.current = recorder;

        await recorder.startRecording(
          (filePath) => leaveToAnalyzing(filePath),
          (error) => {
            console.warn('[recording] 녹화 실패:', error);
            leaveToAnalyzing(null);
          },
        );
        setIsRecording(true);
      } catch (error) {
        // 녹화가 불가능한 환경이어도 판정 플로우는 계속된다.
        console.warn('[recording] 녹화를 시작하지 못했습니다:', error);
        leaveToAnalyzing(null);
      }
    };

    void start();

    // maxDuration이 스스로 끝내지만, 콜백이 오지 않는 경우를 대비한 안전망.
    timer = setTimeout(() => {
      void recorderRef.current?.stopRecording().catch(() => undefined);
    }, MAX_RECORDING_MS + 500);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void recorderRef.current?.stopRecording().catch(() => undefined);
      recorderRef.current = null;
    };
  }, [hasPermission, leaveToAnalyzing, setRecordedUri, videoOutput]);

  const handleCancel = () => {
    void recorderRef.current?.stopRecording().catch(() => undefined);
    hasLeftRef.current = true;
    setRecordedUri(null);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      {hasPermission ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device="front"
          isActive
          outputs={[videoOutput, frameOutput]}
        />
      ) : null}
      <SafeAreaView style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.statusPill}>
          <ThemedText type="smallBold">{isRecording ? '촬영 중' : '준비 중'}</ThemedText>
        </ThemedView>
        <Pressable style={styles.cancelButton} onPress={handleCancel}>
          <ThemedText type="subtitle">취소</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 32,
  },
  statusPill: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
});
