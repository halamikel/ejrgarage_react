// Port of lib/screens/signup_screen.dart.
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { BackButton, CheckRow, ErrorBanner, Field, PrimaryButton, Screen } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { text } from '@/theme/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    try {
      await api.register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      // register.php doesn't log in; the user must click the emailed link first.
      Alert.alert('Account created!', 'Check your email to verify before logging in.');
      router.replace('/login');
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
      <View style={{ height: 24 }} />
      <Text style={[text.headingLarge, { textAlign: 'center', marginBottom: 32 }]}>Create Account</Text>
      <ErrorBanner message={error} />

      <Field label="Full Name" placeholder="Enter your name" value={name} onChangeText={setName} autoComplete="name" />
      <Field
        label="Email Address"
        placeholder="Enter your email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Field
        label="Phone Number"
        placeholder="e.g. 09123456789"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Field
        label="Password"
        placeholder="Enter password"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="new-password"
      />

      <CheckRow checked={agreeTerms} onToggle={() => setAgreeTerms((v) => !v)}>
        <Text style={{ fontSize: 13 }}>I agree with </Text>
        <Link href="/terms" style={text.linkText}>
          Terms & Conditions.
        </Link>
      </CheckRow>

      <View style={{ height: 32 }} />
      <PrimaryButton title="Sign Up" onPress={handleSignUp} loading={loading} disabled={!agreeTerms} />
    </Screen>
  );
}
