import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const COUNTDOWN_START_SECONDS = 3;
const TICK_MS = 1000;

/** 카운트다운 화면(PRD 4.2.2). 3→2→1 숫자 애니메이션 후 사용자의 추가 조작 없이
 * 자동으로 녹화 화면(M2-06)으로 이동한다. */
export default function CountdownScreen() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_START_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace('/elder/recording');
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((prev) => prev - 1), TICK_MS);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText style={styles.countText}>{secondsLeft > 0 ? secondsLeft : ''}</ThemedText>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 160,
    fontWeight: '700',
  },
});
