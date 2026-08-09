import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecordedVideoStore } from '@/store/recorded-video-store';

const MAX_RECORDING_SECONDS = 15;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;

/** 녹화 화면(PRD 4.2.2). 최대 15초 자동 녹화 후 분석 중 화면으로 이동한다. 화면에는
 * "촬영 중" 표시와 취소(뒤로가기) 옵션만 존재한다. 카메라는 expo-camera 기본 녹화만
 * 사용하며(frame processor 미사용), 이 시점의 영상 파일은 Mock 판정에 쓰지 않고
 * 업로드용으로만 분석 화면에 넘긴다(M4-02). */
export default function RecordingScreen() {
  const router = useRouter();
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const setRecordedUri = useRecordedVideoStore((state) => state.setUri);

  useEffect(() => {
    // 직전 촬영의 URI가 남아 잘못 업로드되는 일이 없도록 매번 비우고 시작한다.
    setRecordedUri(null);

    // recordAsync는 stopRecording() 이후에 파일 URI로 resolve된다.
    const recording = permission?.granted
      ? cameraRef.current
          ?.recordAsync({ maxDuration: MAX_RECORDING_SECONDS })
          .catch(() => {
            // 녹화가 불가능한 환경(웹캠 미지원 등)이어도 판정 플로우는 계속된다.
            return undefined;
          })
      : undefined;

    const timer = setTimeout(() => {
      cameraRef.current?.stopRecording();
      void Promise.resolve(recording)
        .then((result) => setRecordedUri(result?.uri ?? null))
        .finally(() => router.replace('/elder/analyzing'));
    }, MAX_RECORDING_MS);

    return () => clearTimeout(timer);
  }, [router, permission?.granted, setRecordedUri]);

  const handleCancel = () => {
    cameraRef.current?.stopRecording();
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      {permission?.granted ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" facing="front" />
      ) : null}
      <SafeAreaView style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.statusPill}>
          <ThemedText type="smallBold">{permission?.granted ? '촬영 중' : '준비 중'}</ThemedText>
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
