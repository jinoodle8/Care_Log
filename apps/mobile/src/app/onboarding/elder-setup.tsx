import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** "초대코드로 어르신 기기 설정" 플레이스홀더. 초대코드 입력 및 연동 로직은 M2-14에서 구현한다. */
export default function ElderSetupScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">어르신 기기 설정</ThemedText>
        <ThemedText type="small">준비 중이에요 (M2에서 구현)</ThemedText>
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
    gap: 8,
  },
});
