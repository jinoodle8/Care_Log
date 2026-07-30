import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const MAX_RECORDING_SECONDS = 15;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;

/** 녹화 화면(PRD 4.2.2). 최대 15초 자동 녹화 후 분석 중 화면으로 이동한다. 화면에는
 * "촬영 중" 표시와 취소(뒤로가기) 옵션만 존재한다. 카메라는 expo-camera 기본 녹화만
 * 사용하며(frame processor 미사용), 이 시점의 영상 파일은 Mock 판정에 사용하지 않는다. */
export default function RecordingScreen() {
  const router = useRouter();
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    if (permission?.granted) {
      cameraRef.current
        ?.recordAsync({ maxDuration: MAX_RECORDING_SECONDS })
        .catch(() => {
          // 카메라 녹화가 불가능한 환경(웹캠 미지원 등)이어도 아래 타이머로 플로우는 계속된다
        });
    }

    const timer = setTimeout(() => {
      cameraRef.current?.stopRecording();
      router.replace('/elder/analyzing');
    }, MAX_RECORDING_MS);

    return () => clearTimeout(timer);
  }, [router, permission?.granted]);

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
