import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { redeemInviteCode } from '@/api/links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useElderSessionStore } from '@/store/elder-session-store';
import { useRoleStore } from '@/store/role-store';

/** 어르신 기기 설정 화면(PRD 4.1.1). 보호자가 발급받은 초대코드를 대신 입력해
 * 어르신 계정을 만들고 이 기기를 어르신 모드로 고정한다. */
export default function ElderSetupScreen() {
  const router = useRouter();
  const setElderId = useElderSessionStore((state) => state.setElderId);
  const setRole = useRoleStore((state) => state.setRole);

  const [code, setCode] = useState('');
  const [elderName, setElderName] = useState('');
  const [elderPhone, setElderPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    code.trim().length > 0 && elderName.trim().length > 0 && elderPhone.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await redeemInviteCode({
        code: code.trim().toUpperCase(),
        elderName: elderName.trim(),
        elderPhone: elderPhone.trim(),
      });

      await setElderId(result.elder.id);
      await setRole('ELDER');
      router.replace('/elder');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : '연결에 실패했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">어르신 기기 설정</ThemedText>
        <ThemedText type="small">보호자 앱에서 받은 초대코드를 입력해 주세요</ThemedText>

        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={setCode}
          placeholder="초대코드 6자리"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <TextInput
          style={styles.input}
          value={elderName}
          onChangeText={setElderName}
          placeholder="어르신 성함"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={elderPhone}
          onChangeText={setElderPhone}
          placeholder="어르신 전화번호"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {errorMessage ? (
          <ThemedText type="small" style={styles.errorText}>
            {errorMessage}
          </ThemedText>
        ) : null}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="subtitle" themeColor="background">
              연동하기
            </ThemedText>
          )}
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
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 24,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorText: {
    color: '#DC2626',
  },
  submitButton: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});
