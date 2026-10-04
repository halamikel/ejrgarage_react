// Port of lib/screens/forgot_password_screen.dart.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { BackButton, ErrorBanner, Field, PrimaryButton, Screen } from '@/components/ui';
import { showAlert } from '@/lib/dialogs';
import { ApiException, api } from '@/services/api';
import { text } from '@/theme/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      await showAlert(
        'Check your email',
        'If an account with that email exists, a password reset link has been sent. Open it from your email app to set a new password, then come back and log in.',
      );
      router.back();
    } catch (e) {
      setError(
        e instanceof ApiException ? e.message : 'Something went wrong. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      <View style={{ height: 32 }} />
      <Text style={[text.headingLarge, { textAlign: 'center', marginBottom: 40 }]}>Forgot Password</Text>
      <Field
        label="Email Address"
        placeholder="example@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <ErrorBanner message={error} />
      <PrimaryButton title="Send Reset Link" onPress={handleSend} loading={loading} />
    </Screen>
  );
}
