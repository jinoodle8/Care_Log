import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth-store';
import { useRoleStore } from '@/store/role-store';

/** 앱 진입점. 저장된 역할(ELDER/GUARDIAN)에 따라 해당 모드로 즉시 이동하고,
 * 역할이 없으면 온보딩으로 보낸다. 저장된 로그인 세션도 함께 복원해
 * API 클라이언트의 Authorization 헤더를 세팅한다. */
export default function IndexGate() {
  const role = useRoleStore((state) => state.role);
  const isLoaded = useRoleStore((state) => state.isLoaded);
  const loadRole = useRoleStore((state) => state.loadRole);
  const loadAuth = useAuthStore((state) => state.load);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);

  useEffect(() => {
    void loadRole();
    void loadAuth();
  }, [loadRole, loadAuth]);

  if (!isLoaded || !isAuthLoaded) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (role === 'ELDER') {
    return <Redirect href="/elder" />;
  }

  if (role === 'GUARDIAN') {
    return <Redirect href="/guardian" />;
  }

  return <Redirect href="/onboarding" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
