import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { fetchLogs } from '@/api/logs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  buildElderHistory,
  historyFromIso,
  type ElderHistoryDay,
} from '@/features/elder/medication-history';
import { useAuthStore } from '@/store/auth-store';

/** 어르신 복약 기록 화면(PRD 4.2.6). 통계·그래프 없이 "언제 어떻게 됐는지"만
 * 큰 글씨로 보여준다. 어르신 모드의 상호작용을 늘리지 않도록 돌아가기 버튼 1개만 둔다. */
export default function ElderHistoryScreen() {
  const router = useRouter();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const [days, setDays] = useState<ElderHistoryDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const load = useCallback(async () => {
    if (!isAuthLoaded || !accessToken || !user) return;

    try {
      const logs = await fetchLogs({ elderId: user.id, from: historyFromIso() });
      setDays(buildElderHistory(logs));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '기록을 불러오지 못했어요.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoaded, user]);

  useEffect(() => {
    // load의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.heading}>
            내 복약 기록
          </ThemedText>

          {isLoading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : errorMessage ? (
            <ThemedText style={styles.bigText}>{errorMessage}</ThemedText>
          ) : days.length === 0 ? (
            <ThemedText style={styles.bigText}>아직 기록이 없어요</ThemedText>
          ) : (
            days.map((day) => (
              <ThemedView key={day.dateKey} style={styles.daySection}>
                <ThemedText type="subtitle" style={styles.dayLabel}>
                  {day.dateLabel}
                </ThemedText>
                {day.entries.map((entry) => (
                  <ThemedView
                    key={entry.logId}
                    type="backgroundElement"
                    style={styles.entryCard}
                  >
                    <ThemedText style={styles.entryText}>
                      {entry.slotLabel} · {entry.statusLabel}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
            ))
          )}
        </ScrollView>

        <Pressable style={styles.backButton} onPress={() => router.replace('/elder')}>
          <ThemedText type="subtitle" themeColor="background" style={styles.backText}>
            돌아가기
          </ThemedText>
        </Pressable>
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
    paddingTop: 24,
    paddingBottom: 16,
    gap: 20,
  },
  heading: {
    marginBottom: 4,
  },
  loader: {
    marginTop: 40,
  },
  bigText: {
    fontSize: 24,
    lineHeight: 34,
    marginTop: 24,
  },
  daySection: {
    gap: 10,
  },
  dayLabel: {
    fontSize: 26,
  },
  entryCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  entryText: {
    fontSize: 24,
    lineHeight: 32,
  },
  backButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#208AEF',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  backText: {
    fontSize: 24,
  },
});
