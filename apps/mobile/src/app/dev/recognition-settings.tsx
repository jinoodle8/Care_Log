import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecognitionSettingsStore } from '@/store/recognition-settings-store';

const RATE_STEP = 0.05;

function clampRate(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

/** 개발자 설정 화면. 어르신 모드에는 노출하지 않고, 보호자 모드에서만 진입 가능하게 한다 (PRD 밖 QA용 화면).
 * 여기서 바꾼 값은 다음 촬영(M2-07 분석 중 화면)의 MockRecognitionEngine 호출에 반영된다. */
export default function RecognitionSettingsScreen() {
  const isLoaded = useRecognitionSettingsStore((state) => state.isLoaded);
  const load = useRecognitionSettingsStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  // 저장된 값을 다 읽은 뒤에 폼을 마운트해, 상태를 처음부터 올바른 값으로 초기화한다.
  if (!isLoaded) {
    return null;
  }

  return <RecognitionSettingsForm />;
}

function RecognitionSettingsForm() {
  const { demoMode, takenRate, uncertainRate, setDemoMode, setTakenRate, setUncertainRate } =
    useRecognitionSettingsStore();

  const missedRate = clampRate(1 - takenRate - uncertainRate);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">개발자 설정</ThemedText>
        <ThemedText type="small">Mock 인식 엔진 동작을 조정합니다 (QA 전용)</ThemedText>

        <ThemedView type="backgroundElement" style={styles.row}>
          <ThemedText type="subtitle">데모 모드</ThemedText>
          <Switch value={demoMode} onValueChange={(value) => void setDemoMode(value)} />
        </ThemedView>
        <ThemedText type="small">켜면 항상 복약 완료(TAKEN)로 판정합니다.</ThemedText>

        <ThemedView type="backgroundElement" style={styles.rateRow}>
          <ThemedText type="subtitle">TAKEN 확률: {(takenRate * 100).toFixed(0)}%</ThemedText>
          <ThemedView style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => void setTakenRate(clampRate(takenRate - RATE_STEP))}
            >
              <ThemedText type="subtitle">−</ThemedText>
            </Pressable>
            <Pressable
              style={styles.stepperButton}
              onPress={() => void setTakenRate(clampRate(takenRate + RATE_STEP))}
            >
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.rateRow}>
          <ThemedText type="subtitle">UNCERTAIN 확률: {(uncertainRate * 100).toFixed(0)}%</ThemedText>
          <ThemedView style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => void setUncertainRate(clampRate(uncertainRate - RATE_STEP))}
            >
              <ThemedText type="subtitle">−</ThemedText>
            </Pressable>
            <Pressable
              style={styles.stepperButton}
              onPress={() => void setUncertainRate(clampRate(uncertainRate + RATE_STEP))}
            >
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        <ThemedText type="small">MISSED 확률(자동 계산): {(missedRate * 100).toFixed(0)}%</ThemedText>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  rateRow: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
