// Port of lib/screens/login_screen.dart.
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { BackButton, CheckRow, ErrorBanner, Field, PrimaryButton, Screen } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { homeRouteForRole, userSession } from '@/services/session';
import { text } from '@/theme/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Same as Flutter: the checkbox is UI-only (the token is always persisted).
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    try {
      const user = await api.login(email.trim(), password);
      userSession.setUser(user);
      router.replace(homeRouteForRole());
    } catch (e) {
      if (e instanceof ApiException) {
        if (e.field === 'email') setEmailError(e.message);
        else if (e.field === 'password') setPasswordError(e.message);
        else setGeneralError(e.message);
      } else {
        setGeneralError('Something went wrong. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      <View style={{ height: 32 }} />
      <ErrorBanner message={generalError} />
      <Text style={[text.headingLarge, { textAlign: 'center', marginBottom: 40 }]}>Welcome Back</Text>

      <Field
        label="Email Address"
        placeholder="Enter your email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={emailError}
        testID="login_email_field"
      />
      <Field
        label="Password"
        placeholder="Enter password"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        error={passwordError}
        testID="login_password_field"
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <CheckRow checked={rememberMe} onToggle={() => setRememberMe((v) => !v)}>
          <Text style={{ fontSize: 13 }}>Remember me</Text>
        </CheckRow>
        <Link href="/forgot-password" style={text.linkText}>
          Forgot Password
        </Link>
      </View>

      <View style={{ height: 40 }} />
      <PrimaryButton title="Log In" onPress={handleLogin} loading={loading} />
    </Screen>
  );
}
