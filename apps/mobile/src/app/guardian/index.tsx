import type { CreateInviteCodeResponse, UserProfile } from '@carelog/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { createInviteCode, fetchMyElders } from '@/api/links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth-store';

/** 보호자 모드 홈. 연동된 어르신 목록과 초대코드 발급을 제공한다.
 * 복약 현황 대시보드는 M2-16에서 구현한다. */
export default function GuardianHomeScreen() {
  const router = useRouter();
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [elders, setElders] = useState<UserProfile[]>([]);
  const [inviteCode, setInviteCode] = useState<CreateInviteCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  const loadElders = useCallback(async () => {
    if (!isAuthLoaded || !accessToken) return;

    try {
      setElders(await fetchMyElders());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '어르신 목록을 불러오지 못했어요.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isAuthLoaded]);

  useEffect(() => {
    // loadElders의 setState는 모두 await 이후(마이크로태스크)에 실행되므로 동기 연쇄 렌더는 발생하지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadElders();
  }, [loadElders]);

  const handleCreateInviteCode = async () => {
    setErrorMessage(null);
    try {
      setInviteCode(await createInviteCode());
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '초대코드를 발급하지 못했어요.',
      );
    }
  };

  if (isAuthLoaded && !accessToken) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">보호자 모드</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">연동된 어르신</ThemedText>
          {isLoading ? (
            <ActivityIndicator />
          ) : elders.length > 0 ? (
            elders.map((elder) => (
              <ThemedText key={elder.id}>
                {elder.name} · {elder.phone}
              </ThemedText>
            ))
          ) : (
            <ThemedText type="small">
              아직 연동된 어르신이 없어요. 초대코드를 발급해 어르신 기기에서 입력해 주세요.
            </ThemedText>
          )}
        </ThemedView>

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
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
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
  errorText: {
    color: '#DC2626',
  },
  devLink: {
    alignSelf: 'center',
    padding: 8,
  },
});
