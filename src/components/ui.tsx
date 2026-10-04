// Shared building blocks replacing Flutter's AppTheme.inputDecoration /
// primaryButtonStyle and the repeated back-button / error-banner markup.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, text } from '@/theme/theme';

/** SafeArea + keyboard avoidance + scroll, with Flutter's 24px side padding. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scrollContent}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BackButton({ fallback = '/get-started' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.back}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
    >
      <Ionicons name="chevron-back" size={20} color={colors.black} />
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={{ color: colors.red, fontSize: 13, fontFamily: fonts.regular }}>{message}</Text>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  /** Adds the show/hide eye toggle and hides the text by default. */
  password?: boolean;
};

export function Field({ label, error, password, style, ...rest }: FieldProps) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={text.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { borderColor: focused ? colors.primary : colors.greyBorder, borderWidth: focused ? 1.5 : 1 },
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={password ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.grey}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Toggle password visibility">
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.grey} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={[text.error, { marginTop: 6 }]}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.button, off && { opacity: 0.5 }, pressed && { opacity: 0.85 }, style]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={text.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={8}
        style={[styles.check, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}
      >
        {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
      </Pressable>
      <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>{children}</View>
    </View>
  );
}

/** Stand-in for screens that haven't been ported from Flutter yet. */
export function Pending({ title, source }: { title: string; source: string }) {
  return (
    <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="construct-outline" size={48} color={colors.primary} />
      <Text style={[text.headingSmall, { marginTop: 16 }]}>{title}</Text>
      <Text style={[text.bodyMedium, { marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
        Not ported yet. Source: {source}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(244,67,54,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.3)',
  },
  inputWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 14, fontFamily: fonts.regular, color: colors.black },
  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.greyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
