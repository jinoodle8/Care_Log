import type { CreateInviteCodeResponse, MedicationLog, UserProfile } from '@carelog/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { createInviteCode, fetchMyElders } from '@/api/links';
import { fetchLogs } from '@/api/logs';
import { subscribeToElderLogs } from '@/api/realtime';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { decisionColor, describeDecision, summarizeTodaySlots } from '@/features/guardian/today-slots';
import { useAuthStore } from '@/store/auth-store';

function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** 보호자 대시보드(PRD 4.3.2). 오늘의 복약 현황을 시간대별 카드로 보여주고,
 * 어르신 전환·초대코드 발급을 제공한다. 실시간 갱신은 M2-20에서 붙인다. */
export default function GuardianDashboardScreen() {
  const router = useRouter();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [elders, setElders] = useState<UserProfile[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [inviteCode, setInviteCode] = useState<CreateInviteCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const loadDashboard = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    try {
      const elderList = await fetchMyElders();
      setElders(elderList);

      const elderId = selectedElderId ?? elderList[0]?.id ?? null;
      setSelectedElderId(elderId);

      if (elderId) {
        setLogs(await fetchLogs({ elderId, from: startOfToday() }));
      } else {
        setLogs([]);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '현황을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, isAuthLoaded, selectedElderId]);

  useEffect(() => {
    // loadDashboard의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  // 어르신이 촬영을 마치면 새로고침 없이 카드가 갱신되도록 실시간 구독한다(M2-20).
  useEffect(() => {
    if (!accessToken || !selectedElderId) return;

    const subscription = subscribeToElderLogs({
      accessToken,
      elderId: selectedElderId,
      onLogCreated: (log) => {
        if (log.elderId !== selectedElderId) return;
        setLogs((prev) => (prev.some((item) => item.id === log.id) ? prev : [log, ...prev]));
      },
    });

    return () => subscription.close();
  }, [accessToken, selectedElderId]);

  const handleCreateInviteCode = async () => {
    try {
      setInviteCode(await createInviteCode());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '초대코드를 발급하지 못했어요.');
    }
  };

  if (isAuthLoaded && !accessToken) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title">보호자 모드</ThemedText>
          <ThemedText>로그인이 필요해요</ThemedText>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/onboarding/guardian-start')}
          >
            <ThemedText type="subtitle" themeColor="background">
              로그인하기
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const slots = summarizeTodaySlots(logs);
  const selectedElder = elders.find((elder) => elder.id === selectedElderId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                void loadDashboard();
              }}
            />
          }
        >
          <ThemedText type="title">오늘의 복약</ThemedText>

          {elders.length > 1 ? (
            <ThemedView style={styles.elderTabs}>
              {elders.map((elder) => (
                <Pressable
                  key={elder.id}
                  style={[
                    styles.elderTab,
                    elder.id === selectedElderId && styles.elderTabSelected,
                  ]}
                  onPress={() => setSelectedElderId(elder.id)}
                >
                  <ThemedText type="smallBold">{elder.name}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          ) : null}

          {isLoading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : elders.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="subtitle">연동된 어르신이 없어요</ThemedText>
              <ThemedText type="small">
                초대코드를 발급해 어르신 기기에서 입력하면 복약 현황을 볼 수 있어요.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {selectedElder ? (
                <ThemedText type="small">{selectedElder.name} 어르신</ThemedText>
              ) : null}
              {slots.map((slot) => (
                <ThemedView key={slot.slot} type="backgroundElement" style={styles.slotCard}>
                  <ThemedView style={styles.slotHeader}>
                    <ThemedText type="subtitle">{slot.label}</ThemedText>
                    <ThemedView
                      style={[styles.badge, { backgroundColor: decisionColor(slot.decision) }]}
                    >
                      <ThemedText type="smallBold" style={styles.badgeText}>
                        {describeDecision(slot.decision)}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                  {slot.takenAt ? (
                    <ThemedText type="small">
                      {new Date(slot.takenAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              ))}
            </>
          )}

          {selectedElderId ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                router.push({
                  pathname: '/guardian/timeline',
                  params: { elderId: selectedElderId },
                })
              }
            >
              <ThemedText type="subtitle">복약 타임라인 보기</ThemedText>
            </Pressable>
          ) : null}

          {selectedElderId ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                router.push({
                  pathname: '/guardian/schedules',
                  params: { elderId: selectedElderId },
                })
              }
            >
              <ThemedText type="subtitle">복약 스케줄 설정</ThemedText>
            </Pressable>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">초대코드</ThemedText>
            {inviteCode ? (
              <>
                <ThemedText style={styles.inviteCode}>{inviteCode.code}</ThemedText>
                <ThemedText type="small">
                  {new Date(inviteCode.expiresAt).toLocaleString('ko-KR')}까지 사용할 수 있어요
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small">어르신 기기 설정에 사용할 코드를 발급하세요.</ThemedText>
            )}
            <Pressable style={styles.primaryButton} onPress={() => void handleCreateInviteCode()}>
              <ThemedText type="subtitle" themeColor="background">
                {inviteCode ? '새 코드 발급' : '초대코드 발급'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}

          <Pressable style={styles.devLink} onPress={() => router.push('/dev/recognition-settings')}>
            <ThemedText type="link">개발자 설정 (QA)</ThemedText>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loader: {
    marginVertical: 24,
  },
  elderTabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  elderTab: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  elderTabSelected: {
    borderColor: '#208AEF',
    backgroundColor: '#E6F1FD',
  },
  slotCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  inviteCode: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#DC2626',
  },
  devLink: {
    alignSelf: 'center',
    padding: 8,
  },
});
