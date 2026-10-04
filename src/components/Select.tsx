// Dropdown replacement (Flutter's DropdownButtonFormField): a tappable field
// that opens a bottom sheet of options.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { colors, fonts, text } from '@/theme/theme';

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  testID,
}: {
  label?: string;
  value: string | null;
  options: (string | SelectOption)[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts: SelectOption[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = opts.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: 20 }}>
      {label ? <Text style={[text.label, { marginBottom: 8 }]}>{label}</Text> : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.greyBorder,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 16,
          backgroundColor: disabled ? colors.greyLight : colors.white,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: selected ? colors.black : colors.grey }}
        >
          {selected ? selected.label : (placeholder ?? `Select ${(label ?? '').toLowerCase()}`)}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.grey} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} scroll={false}>
        {label ? <Text style={[text.headingSmall, { marginBottom: 8 }]}>{label}</Text> : null}
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {opts.map((o) => {
            const isSel = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.greyLight }}
              >
                <Text style={{ flex: 1, fontFamily: isSel ? fonts.semibold : fonts.regular, fontSize: 14, color: isSel ? colors.primary : colors.black }}>
                  {o.label}
                </Text>
                {isSel && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}
