// Message input bar. Clears immediately on send and restores the text if
// the parent reports the send failed (onSend resolves false).
import { colors, fonts } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

type Props = {
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
  disabled?: boolean;
};

const MAX_LENGTH = 1000;

export function Composer({ onSend, placeholder = 'Type a message…', disabled }: Props) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const submit = async () => {
    if (!canSend) return;
    const body = trimmed;
    setValue('');
    const ok = await onSend(body);
    if (!ok) setValue((current) => (current.length === 0 ? body : current));
  };

  return (
    <View style={styles.bar}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        multiline
        maxLength={MAX_LENGTH}
        style={styles.input}
        accessibilityLabel="Message"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={[styles.send, !canSend && { opacity: 0.4 }]}
      >
        <Ionicons name="send" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.greyBorder,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.greyLight,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.black,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
