// Star display / input and the required "rate your service" sheet.
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { PrimaryButton } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { Json } from '@/services/api';
import { MAX_RATING, RATING_LABELS, getAllFeedback, submitJobFeedback, type JobFeedback, type RatingStats } from '@/services/jobFeedback';
import { refreshPoints } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

const STAR = '#F5B301';

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 8 : 2 }}>
      {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((n) => {
        const icon = <Ionicons name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? STAR : colors.greyBorder} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

/** Read-only rating + comment shown on cards/details. */
export function FeedbackSummary({ feedback }: { feedback: JobFeedback }) {
  return (
    <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.greyLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Stars value={feedback.rating} size={14} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12 }}>{RATING_LABELS[feedback.rating]}</Text>
      </View>
      {feedback.comment ? <Text style={[text.bodyMedium, { marginTop: 6, fontSize: 13 }]}>“{feedback.comment}”</Text> : null}
    </View>
  );
}

/**
 * Required rating prompt. It cannot be dismissed (no close button, backdrop tap
 * or Android back does nothing) — Submit stays disabled until 1-5 stars are chosen.
 */
export function RatingSheet({ appointment, onSubmitted }: { appointment: Json | null; onSubmitted: (f: JobFeedback) => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRating(0);
    setComment('');
    setError('');
  }, [appointment?.id]);

  async function submit() {
    if (!appointment || rating < 1 || saving) return;
    setSaving(true);
    setError('');
    try {
      const f = await submitJobFeedback({
        appointmentId: appointment.id,
        rating,
        comment,
        mechanicName: appointment.mechanic_name ? String(appointment.mechanic_name) : undefined,
        serviceType: appointment.service_type ? String(appointment.service_type) : undefined,
      });
      // The server awards review points; re-read the balance and only mention
      // points if it actually went up.
      const gained = await refreshPoints();
      toast(
        gained && gained > 0 ? `Thank you for your feedback! +${gained} EJR points` : 'Thank you for your feedback!',
        'success',
      );
      onSubmitted(f);
    } catch (e) {
      // Toasts render behind the modal, so show the error inside the sheet.
      setError(e instanceof Error ? e.message : 'Could not save your feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={appointment != null} onClose={() => {}}>
      {appointment && (
        <>
          <Text style={text.headingSmall}>How was your service?</Text>
          <Text style={[text.bodyMedium, { marginTop: 4 }]}>
            {appointment.service_type ? String(appointment.service_type) : 'Service'}
            {appointment.mechanic_name ? ` • ${String(appointment.mechanic_name)}` : ''}
          </Text>
          <Text style={text.bodySmall}>{formatDateTime(appointment.appointment_date)}</Text>

          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Stars value={rating} size={40} onChange={setRating} />
            <Text style={{ marginTop: 10, fontFamily: fonts.semibold, fontSize: 14, color: rating ? colors.black : colors.grey }}>
              {rating ? RATING_LABELS[rating] : 'Tap a star to rate (required)'}
            </Text>
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us more about your experience (optional)"
            placeholderTextColor={colors.grey}
            multiline
            maxLength={500}
            style={{ minHeight: 80, borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.black, textAlignVertical: 'top' }}
          />
          {error ? <Text style={{ marginTop: 10, fontFamily: fonts.regular, fontSize: 13, color: colors.red }}>{error}</Text> : null}
          <PrimaryButton title="Submit Feedback" onPress={submit} loading={saving} disabled={rating < 1} style={{ marginTop: 16 }} />
        </>
      )}
    </Sheet>
  );
}

/** All stored feedback, reloaded whenever the screen regains focus. */
export function useAllFeedback() {
  const [all, setAll] = useState<JobFeedback[]>([]);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      getAllFeedback().then((f) => live && setAll(f));
      return () => {
        live = false;
      };
    }, []),
  );
  return all;
}

/** Compact "★ 4.5 (12)" badge; shows "No ratings yet" when there are none. */
export function AverageRating({ stats, size = 14 }: { stats: RatingStats | null; size?: number }) {
  if (!stats) return <Text style={{ fontFamily: fonts.regular, fontSize: size - 1, color: colors.grey }}>No ratings yet</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={size} color={STAR} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: size }}>{stats.average.toFixed(1)}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: size - 2, color: colors.grey }}>
        ({stats.count} {stats.count === 1 ? 'rating' : 'ratings'})
      </Text>
    </View>
  );
}