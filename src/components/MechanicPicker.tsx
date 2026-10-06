// Optional "choose your mechanic" field for the booking form. Shows each
// mechanic's average star rating; "No preference" is always available.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AverageRating } from '@/components/Rating';
import { Sheet } from '@/components/Sheet';
import type { Json } from '@/services/api';
import { statsForMechanicName, type JobFeedback, type RatingStats } from '@/services/jobFeedback';
import { colors, fonts, text } from '@/theme/theme';

/** Mechanics in these states can't take new work, so they can't be picked. */
const UNBOOKABLE = new Set(['unavailable', 'on_break']);
const STATUS_LABEL: Record<string, string> = { unavailable: 'Unavailable', on_break: 'On leave', on_duty: 'Busy' };

export const isBookable = (m: Json) => !UNBOOKABLE.has(String(m.status ?? 'available'));

/** Server average (all customers) first; this device's own ratings only as a fallback. */
export function mechanicStats(m: Json, localFeedback: JobFeedback[]): RatingStats | null {
  const avg = Number(m.avg_rating);
  const count = Number(m.rating_count ?? 0);
  if (m.avg_rating != null && Number.isFinite(avg) && count > 0) return { average: avg, count };
  return statsForMechanicName(localFeedback, m.name);
}

export function MechanicPicker({
  mechanics,
  selectedId,
  onSelect,
  localFeedback,
}: {
  mechanics: Json[];
  selectedId: number | null;
  onSelect: (m: Json | null) => void;
  localFeedback: JobFeedback[];
}) {
  const [open, setOpen] = useState(false);
  const selected = mechanics.find((m) => Number(m.id) === selectedId) ?? null;

  function pick(m: Json | null) {
    onSelect(m);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose a mechanic (optional)"
        style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: selected ? colors.black : colors.grey }}>
            {selected ? String(selected.name) : 'No preference'}
          </Text>
          {selected && (
            <View style={{ marginTop: 4 }}>
              <AverageRating stats={mechanicStats(selected, localFeedback)} size={12} />
            </View>
          )}
        </View>
        {selected ? (
          <Pressable onPress={() => onSelect(null)} hitSlop={8} accessibilityLabel="Clear mechanic" style={{ marginRight: 10 }}>
            <Ionicons name="close-circle" size={20} color={colors.grey} />
          </Pressable>
        ) : null}
        <Ionicons name="chevron-down" size={20} color={colors.grey} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)}>
        <Text style={text.headingSmall}>Choose a Mechanic</Text>
        <Text style={[text.bodySmall, { marginTop: 4, marginBottom: 14 }]}>
          Optional. Skip it and the shop will assign an available mechanic.
        </Text>

        <Row selected={selectedId == null} onPress={() => pick(null)}>
          <View style={circle}>
            <Ionicons name="shuffle-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>No preference</Text>
            <Text style={text.bodySmall}>Any available mechanic</Text>
          </View>
        </Row>

        {mechanics.map((m) => {
          const ok = isBookable(m);
          const status = STATUS_LABEL[String(m.status ?? '')];
          return (
            <Row key={String(m.id)} selected={Number(m.id) === selectedId} disabled={!ok} onPress={() => pick(m)}>
              <View style={circle}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>
                  {String(m.name ?? '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14 }}>{String(m.name)}</Text>
                  {status ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.grey }}>{status}</Text> : null}
                </View>
                {m.specialty ? <Text numberOfLines={1} style={text.bodySmall}>{String(m.specialty)}</Text> : null}
                <View style={{ marginTop: 4 }}>
                  <AverageRating stats={mechanicStats(m, localFeedback)} size={13} />
                </View>
              </View>
            </Row>
          );
        })}
      </Sheet>
    </>
  );
}

function Row({ selected, disabled, onPress, children }: { selected: boolean; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.greyBorder,
        backgroundColor: selected ? colors.primaryLight : colors.white,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

const circle = { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' } as const;
