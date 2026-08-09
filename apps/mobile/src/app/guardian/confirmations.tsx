import type { MedicationLog, UserProfile } from '@carelog/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { fetchMyElders } from '@/api/links';
import { fetchLogs, manualConfirmLog } from '@/api/logs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LogVideoPlayer } from '@/features/guardian/log-video-player';
import { useAuthStore } from '@/store/auth-store';

const ACTION_SEQUENCE_LABELS: Record<string, string> = {
  pick_up: '약 집기',
  hand_to_mouth: '입으로 가져가기',
  swallow: '삼키기',
  drink_water: '물 마시기',
};

function weekAgoIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** UNCERTAIN 수동확인 화면(PRD 4.3.5). 확인이 필요한 기록만 모아 보여주고,
 * 판정 근거(신뢰도·인식된 동작·녹화 영상)를 함께 제시해 보호자가 확인/미복용으로 정리한다. */
export default function GuardianConfirmationsScreen() {
  const params = useLocalSearchParams<{ elderId?: string }>();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [elder, setElder] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const loadPending = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    try {
      const elders = await fetchMyElders();
      const target = elders.find((item) => item.id === params.elderId) ?? elders[0] ?? null;
      setElder(target);
      setLogs(
        target
          ? await fetchLogs({ elderId: target.id, from: weekAgoIso(), decision: 'UNCERTAIN' })
          : [],
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '목록을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoaded, params.elderId]);

  useEffect(() => {
    // loadPending의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPending();
  }, [loadPending]);

  const handleConfirm = async (logId: string, decision: 'TAKEN' | 'MISSED') => {
    setProcessingId(logId);
    try {
      await manualConfirmLog(logId, { decision });
      // 처리된 건은 더 이상 "확인 필요"가 아니므로 목록에서 뺀다.
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '처리하지 못했어요.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">확인이 필요해요</ThemedText>
          {elder ? (
            <ThemedText type="small">{elder.name} 어르신 · 최근 7일</ThemedText>
          ) : null}

          {isLoading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : logs.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="subtitle">확인할 기록이 없어요</ThemedText>
              <ThemedText type="small">모든 기록이 정리되어 있어요.</ThemedText>
            </ThemedView>
          ) : (
            logs.map((log) => {
              const isProcessing = processingId === log.id;
              const steps = log.actionSequence
                .map((step) => ACTION_SEQUENCE_LABELS[step] ?? step)
                .join(' → ');

              return (
                <ThemedView key={log.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="subtitle">
                    {new Date(log.takenAt).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </ThemedText>

                  <ThemedText type="small">
                    신뢰도 {(log.sequenceConf * 100).toFixed(0)}%
                  </ThemedText>
                  <ThemedText type="small">
                    인식된 동작: {steps.length > 0 ? steps : '없음'}
                  </ThemedText>
                  {log.videoRef ? (
                    <LogVideoPlayer logId={log.id} />
                  ) : (
                    <ThemedText type="small">저장된 영상이 없어요</ThemedText>
                  )}

                  <ThemedView style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionButton, styles.confirmButton]}
                      disabled={isProcessing}
                      onPress={() => void handleConfirm(log.id, 'TAKEN')}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText type="subtitle" themeColor="background">
                          복약 확인
                        </ThemedText>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.missedButton]}
                      disabled={isProcessing}
                      onPress={() => void handleConfirm(log.id, 'MISSED')}
                    >
                      <ThemedText type="subtitle">미복용 처리</ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              );
            })
          )}

          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  loader: {
    marginVertical: 24,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#22C55E',
  },
  missedButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  errorText: {
    color: '#DC2626',
  },
});
