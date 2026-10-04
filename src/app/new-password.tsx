// Port of lib/screens/new_password_screen.dart.
// Reached from the emailed reset link via +native-intent.tsx -> /new-password?token=...
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { BackButton, ErrorBanner, Field, PrimaryButton, Screen } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { colors, text } from '@/theme/theme';

export default function NewPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!password || password !== confirm) {
      setError('Passwords do not match or are empty.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword({ token: token ?? '', newPassword: password });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiException ? e.message : 'Something went wrong. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={72} color={colors.green} />
          <Text style={[text.headingSmall, { marginTop: 16 }]}>Password Changed!</Text>
          <Text style={[text.bodyMedium, { marginTop: 8, marginBottom: 32, textAlign: 'center' }]}>
            Your password has been changed successfully.
          </Text>
          <PrimaryButton title="Back to Login" onPress={() => router.replace('/login')} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton fallback="/login" />
      <View style={{ height: 32 }} />
      <Text style={[text.headingLarge, { textAlign: 'center', marginBottom: 40 }]}>New Password</Text>
      <Field
        label="Password"
        placeholder="Enter new password"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
      />
      <Field
        label="Confirm Password"
        placeholder="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        password
        autoCapitalize="none"
      />
      <ErrorBanner message={error} />
      <PrimaryButton title="Reset Password" onPress={handleReset} loading={loading} />
    </Screen>
  );
}
