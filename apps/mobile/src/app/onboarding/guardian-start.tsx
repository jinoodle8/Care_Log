import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login, signup } from '@/api/auth';
import { ApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth-store';
import { useRoleStore } from '@/store/role-store';

type Mode = 'signup' | 'login';

/** 보호자 회원가입/로그인 화면(PRD 4.1.1). 성공 시 역할을 GUARDIAN으로 저장하고
 * 보호자 모드로 진입한다. */
export default function GuardianStartScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setRole = useRoleStore((state) => state.setRole);

  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const canSubmit =
    phone.trim().length > 0 && password.length > 0 && (!isSignup || name.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = isSignup
        ? await signup({ name: name.trim(), phone: phone.trim(), password })
        : await login({ phone: phone.trim(), password });

      await setAuth(result);
      await setRole('GUARDIAN');
      router.replace('/guardian');
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
        <ThemedText type="title">{isSignup ? '보호자 회원가입' : '보호자 로그인'}</ThemedText>

        {isSignup ? (
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="이름"
            autoCorrect={false}
          />
        ) : null}

        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="전화번호"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={isSignup ? '비밀번호 (8자 이상)' : '비밀번호'}
          secureTextEntry
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
              {isSignup ? '가입하기' : '로그인'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(isSignup ? 'login' : 'signup');
            setErrorMessage(null);
          }}
        >
          <ThemedText type="link">
            {isSignup ? '이미 계정이 있어요 · 로그인' : '계정이 없어요 · 회원가입'}
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
