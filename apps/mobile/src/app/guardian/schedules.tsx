import type { Schedule, ScheduleSlot, UserProfile } from '@carelog/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { fetchMyElders } from '@/api/links';
import { createSchedule, fetchSchedules, updateSchedule } from '@/api/schedules';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DEFAULT_SLOT_TIME,
  SLOT_LABELS,
  SLOT_ORDER,
  formatTimeLabel,
  shiftTime,
} from '@/features/guardian/schedule-time';
import { useAuthStore } from '@/store/auth-store';

const STEP_MINUTES = 10;

/** 복약 스케줄 설정(PRD 4.3.6). 보호자가 어르신 대신 아침/점심/저녁 시각과 on/off를 설정한다.
 * 저장 즉시 서버에 반영되며, 어르신 기기의 알림 스케줄은 다음 알림부터 적용된다(M3-07). */
export default function GuardianSchedulesScreen() {
  const params = useLocalSearchParams<{ elderId?: string }>();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [elder, setElder] = useState<UserProfile | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<ScheduleSlot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const loadSchedules = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    try {
      const elders = await fetchMyElders();
      const target = elders.find((item) => item.id === params.elderId) ?? elders[0] ?? null;
      setElder(target);
      setSchedules(target ? await fetchSchedules(target.id) : []);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '스케줄을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoaded, params.elderId]);

  useEffect(() => {
    // loadSchedules의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSchedules();
  }, [loadSchedules]);

  /** 슬롯의 스케줄이 없으면 만들고, 있으면 수정한다. */
  const persistSlot = async (
    slot: ScheduleSlot,
    changes: { time?: string; enabled?: boolean },
  ) => {
    if (!elder) return;

    setSavingSlot(slot);
    try {
      const existing = schedules.find((item) => item.slot === slot);
      const saved = existing
        ? await updateSchedule(existing.id, changes)
        : await createSchedule({
            elderId: elder.id,
            slot,
            time: changes.time ?? DEFAULT_SLOT_TIME[slot],
            enabled: changes.enabled ?? true,
          });

      setSchedules((prev) => {
        const rest = prev.filter((item) => item.slot !== slot);
        return [...rest, saved];
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '스케줄을 저장하지 못했어요.');
    } finally {
      setSavingSlot(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">복약 스케줄</ThemedText>
          {elder ? (
            <ThemedText type="small">{elder.name} 어르신의 알림 시각을 설정해요</ThemedText>
          ) : null}

          {isLoading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : !elder ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small">
                연동된 어르신이 없어요. 먼저 초대코드로 어르신 기기를 설정해 주세요.
              </ThemedText>
            </ThemedView>
          ) : (
            SLOT_ORDER.map((slot) => {
              const schedule = schedules.find((item) => item.slot === slot);
              const time = schedule?.time ?? DEFAULT_SLOT_TIME[slot];
              const enabled = schedule?.enabled ?? false;
              const isSaving = savingSlot === slot;

              return (
                <ThemedView key={slot} type="backgroundElement" style={styles.card}>
                  <ThemedView style={styles.cardHeader}>
                    <ThemedText type="subtitle">{SLOT_LABELS[slot]}</ThemedText>
                    <Switch
                      value={enabled}
                      disabled={isSaving}
                      onValueChange={(value) => void persistSlot(slot, { time, enabled: value })}
                    />
                  </ThemedView>

                  <ThemedText type="title" style={styles.timeText}>
                    {formatTimeLabel(time)}
                  </ThemedText>

                  <ThemedView style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepperButton}
                      disabled={isSaving}
                      onPress={() =>
                        void persistSlot(slot, {
                          time: shiftTime(time, -STEP_MINUTES),
                          enabled: schedule ? undefined : true,
                        })
                      }
                    >
                      <ThemedText type="subtitle">−10분</ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.stepperButton}
                      disabled={isSaving}
                      onPress={() =>
                        void persistSlot(slot, {
                          time: shiftTime(time, STEP_MINUTES),
                          enabled: schedule ? undefined : true,
                        })
                      }
                    >
                      <ThemedText type="subtitle">+10분</ThemedText>
                    </Pressable>
                  </ThemedView>

                  {schedule ? null : (
                    <ThemedText type="small">아직 설정되지 않았어요 (기본값 표시)</ThemedText>
                  )}
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
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  stepperButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorText: {
    color: '#DC2626',
  },
});
