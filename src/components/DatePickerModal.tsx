// Month-grid calendar with disabled days (Flutter's showDatePicker with
// selectableDayPredicate). The native date pickers can't grey out specific
// days, and the booking flow needs to block fully-booked dates.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors, fonts, text } from '@/theme/theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local 'YYYY-MM-DD' (no timezone shifting). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function DatePickerModal({
  visible,
  value,
  minDate,
  maxDate,
  isDisabled,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: Date | null;
  minDate: Date;
  maxDate: Date;
  /** Extra per-day rule (e.g. fully booked). Receives a midnight-local Date. */
  isDisabled?: (d: Date) => boolean;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const min = startOfDay(minDate);
  const max = startOfDay(maxDate);
  const [cursor, setCursor] = useState(() => new Date((value ?? min).getFullYear(), (value ?? min).getMonth(), 1));

  useEffect(() => {
    if (visible) {
      const base = value ?? min;
      setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay(); // Sunday-first
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const canPrev = new Date(year, month, 1) > new Date(min.getFullYear(), min.getMonth(), 1);
  const canNext = new Date(year, month, 1) < new Date(max.getFullYear(), max.getMonth(), 1);
  const selectedKey = value ? ymd(value) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.white, borderRadius: 20, padding: 16, width: '100%', maxWidth: 360 }} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Pressable disabled={!canPrev} onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} accessibilityLabel="Previous month" style={{ opacity: canPrev ? 1 : 0.3, padding: 6 }}>
              <Ionicons name="chevron-back" size={22} color={colors.black} />
            </Pressable>
            <Text style={text.headingSmall}>{`${MONTHS[month]} ${year}`}</Text>
            <Pressable disabled={!canNext} onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10} accessibilityLabel="Next month" style={{ opacity: canNext ? 1 : 0.3, padding: 6 }}>
              <Ionicons name="chevron-forward" size={22} color={colors.black} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.grey, paddingVertical: 6 }}>
                {w}
              </Text>
            ))}
          </View>

          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day == null) return <View key={col} style={{ flex: 1, height: 42 }} />;
                const d = new Date(year, month, day);
                const disabled = d < min || d > max || (isDisabled?.(d) ?? false);
                const isSel = ymd(d) === selectedKey;
                const isToday = ymd(d) === ymd(new Date());
                return (
                  <Pressable
                    key={col}
                    disabled={disabled}
                    accessibilityLabel={ymd(d)}
                    onPress={() => {
                      onSelect(d);
                      onClose();
                    }}
                    style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSel ? colors.primary : 'transparent',
                        borderWidth: isToday && !isSel ? 1 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isSel ? fonts.bold : fonts.regular,
                          fontSize: 14,
                          color: isSel ? colors.white : disabled ? '#C8C8C8' : colors.black,
                          textDecorationLine: disabled && !(d < min || d > max) ? 'line-through' : 'none',
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Pressable onPress={onClose} style={{ alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 8, marginTop: 4 }}>
            <Text style={text.linkText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
