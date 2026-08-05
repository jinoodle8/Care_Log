import type { LogStats, MedicationLog, UserProfile } from '@carelog/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { fetchMyElders } from '@/api/links';
import { fetchLogStats, fetchLogs } from '@/api/logs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { decisionColor, describeDecision } from '@/features/guardian/today-slots';
import { buildWeeklyAdherence, sortLogsByRecent } from '@/features/guardian/weekly-adherence';
import { useAuthStore } from '@/store/auth-store';

const CHART_HEIGHT = 120;

function weekAgoIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** 복약 타임라인(PRD 4.3.3). 일 단위 기록 리스트와 주 단위 이행률 그래프를 함께 보여준다. */
export default function GuardianTimelineScreen() {
  const params = useLocalSearchParams<{ elderId?: string }>();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [elder, setElder] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const loadTimeline = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    try {
      const elders = await fetchMyElders();
      const target = elders.find((item) => item.id === params.elderId) ?? elders[0] ?? null;
      setElder(target);

      if (target) {
        const [weekLogs, weekStats] = await Promise.all([
          fetchLogs({ elderId: target.id, from: weekAgoIso() }),
          fetchLogStats({ elderId: target.id, range: 'week' }),
        ]);
        setLogs(weekLogs);
        setStats(weekStats);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '이력을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoaded, params.elderId]);

  useEffect(() => {
    // loadTimeline의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTimeline();
  }, [loadTimeline]);

  const weekly = buildWeeklyAdherence(logs);
  const recentLogs = sortLogsByRecent(logs);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">복약 타임라인</ThemedText>
          {elder ? <ThemedText type="small">{elder.name} 어르신 · 최근 7일</ThemedText> : null}

          {isLoading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="subtitle">주간 이행률</ThemedText>
                {stats ? (
                  <ThemedText type="small">
                    복약 완료 {stats.takenCount}건 / 전체 {stats.scheduledCount}건 ·{' '}
                    {(stats.adherenceRate * 100).toFixed(0)}%
                  </ThemedText>
                ) : null}

                <View style={styles.chart}>
                  {weekly.map((day) => (
                    <View key={day.date} style={styles.chartColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height:
                                day.adherenceRate === null
                                  ? 0
                                  : Math.max(4, day.adherenceRate * CHART_HEIGHT),
                            },
                          ]}
                        />
                      </View>
                      <ThemedText type="small">{day.weekdayLabel}</ThemedText>
                      <ThemedText type="small">
                        {day.adherenceRate === null
                          ? '-'
                          : `${(day.adherenceRate * 100).toFixed(0)}%`}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                <ThemedText type="small">이행률 = 복약 완료 건수 ÷ 전체 기록 건수</ThemedText>
              </ThemedView>

              <ThemedText type="subtitle">기록</ThemedText>
              {recentLogs.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small">최근 7일간 기록이 없어요.</ThemedText>
                </ThemedView>
              ) : (
                recentLogs.map((log) => (
                  <ThemedView key={log.id} type="backgroundElement" style={styles.logRow}>
                    <ThemedView style={styles.logRowHeader}>
                      <ThemedText type="smallBold">
                        {new Date(log.takenAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                      <ThemedView
                        style={[styles.badge, { backgroundColor: decisionColor(log.decision) }]}
                      >
                        <ThemedText type="smallBold" style={styles.badgeText}>
                          {describeDecision(log.decision)}
                        </ThemedText>
                      </ThemedView>
                    </ThemedView>
                    <ThemedText type="small">
                      신뢰도 {(log.sequenceConf * 100).toFixed(0)}%
                    </ThemedText>
                  </ThemedView>
                ))
              )}
            </>
          )}

          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}

          <Pressable style={styles.refreshButton} onPress={() => void loadTimeline()}>
            <ThemedText type="link">새로고침</ThemedText>
          </Pressable>
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
    gap: 8,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: 20,
    justifyContent: 'flex-end',
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#22C55E',
  },
  logRow: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  logRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
  },
  refreshButton: {
    alignSelf: 'center',
    padding: 8,
  },
});
