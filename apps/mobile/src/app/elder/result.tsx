import type { Decision, Detection } from '@carelog/shared';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLatestRecognitionResultStore } from '@/store/latest-recognition-result-store';

const MESSAGE_BY_DECISION: Record<Decision, { title: string; body: string }> = {
  TAKEN: { title: '복약 완료!', body: '따님께 알려드렸어요' },
  UNCERTAIN: { title: '확인 중이에요', body: '따님이 곧 확인할 거예요' },
  MISSED: { title: '확인하지 못했어요', body: '다음 시간에 다시 시도해 주세요' },
};

const DETECTION_COLOR: Record<Detection['cls'], string> = {
  face: '#22C55E',
  pill: '#F59E0B',
  hand: '#3B82F6',
};

const PREVIEW_SIZE = 280;

/** 결과 화면(PRD 4.2.4). 판정에 따라 메시지를 분기하고, mock detections를 화면 중앙
 * 미리보기 영역에 Bounding Box + 신뢰도로 오버레이한다. 홈으로 돌아가는 동작은
 * 버튼 1개로 제공한다. */
export default function ResultScreen() {
  const router = useRouter();
  const result = useLatestRecognitionResultStore((state) => state.result);
  const clearResult = useLatestRecognitionResultStore((state) => state.clear);

  if (!result) {
    return <Redirect href="/elder" />;
  }

  const message = MESSAGE_BY_DECISION[result.finalDecision];

  const handleConfirm = () => {
    clearResult();
    router.replace('/elder');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.centerText}>
          {message.title}
        </ThemedText>
        <ThemedText type="subtitle" style={styles.centerText}>
          {message.body}
        </ThemedText>

        <View style={styles.previewBox}>
          {result.detections.map((detection) => (
            <DetectionOverlay key={detection.cls} detection={detection} />
          ))}
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <ThemedText type="subtitle" themeColor="background">
            확인
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function DetectionOverlay({ detection }: { detection: Detection }) {
  const [x1, y1, x2, y2] = detection.bbox;
  const color = DETECTION_COLOR[detection.cls];

  return (
    <View
      style={[
        styles.detectionBox,
        {
          borderColor: color,
          left: x1 * PREVIEW_SIZE,
          top: y1 * PREVIEW_SIZE,
          width: (x2 - x1) * PREVIEW_SIZE,
          height: (y2 - y1) * PREVIEW_SIZE,
        },
      ]}
    >
      <ThemedText style={[styles.detectionLabel, { backgroundColor: color }]}>
        {detection.cls} {(detection.conf * 100).toFixed(0)}%
      </ThemedText>
    </View>
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
    gap: 24,
    padding: 24,
  },
  centerText: {
    textAlign: 'center',
  },
  previewBox: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 16,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  detectionLabel: {
    position: 'absolute',
    top: -20,
    left: -2,
    color: '#fff',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confirmButton: {
    backgroundColor: '#208AEF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
});
