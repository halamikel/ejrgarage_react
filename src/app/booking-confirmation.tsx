// Port of lib/screens/customer/booking_confirmation_screen.dart — step 3 of 3.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ErrorBanner, PrimaryButton } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { bookingDraft } from '@/services/bookingDraft';
import { colors, fonts, text } from '@/theme/theme';

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const { vehicle, services, notes } = bookingDraft.get();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmBooking() {
    if (!vehicle) return;
    setSubmitting(true);
    setError(null);
    try {
      // `notes` is collected for parity with the web form but, as in the Flutter
      // app, save_booking.php isn't sent it.
      await api.submitBooking({ services, vehicle: { ...vehicle } });
      bookingDraft.clear();
      // Flutter: popUntil(first) then push(AppointmentScreen).
      router.dismissAll();
      router.push('/appointments');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not connect to the server. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!vehicle || services.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.white }}>
        <Text style={[text.bodyMedium, { textAlign: 'center', marginBottom: 16 }]}>Your booking details were lost. Please start again.</Text>
        <PrimaryButton title="Back to Booking" onPress={() => router.dismissAll()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const rows: [string, string][] = [
    ['Brand', vehicle.brand],
    ['Model', vehicle.model],
    ['Year', vehicle.year],
    ['Plate Number', vehicle.plate],
    ['Transmission', vehicle.transmission],
    ['Fuel Type', vehicle.fuel],
    ['Appointment Date', vehicle.appointmentDate],
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.white }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={text.bodySmall}>Step 3 of 3</Text>
      <Text style={[text.headingMedium, { fontSize: 20, marginTop: 8 }]}>Review Your Appointment</Text>
      <Text style={[text.bodySmall, { fontSize: 13, marginTop: 6, marginBottom: 20 }]}>
        Thank you for choosing EJR Garage! Please review the details below before finalizing.
      </Text>
      <ErrorBanner message={error} />

      <View style={{ padding: 20, borderRadius: 16, backgroundColor: colors.greyLight }}>
        <Text style={heading}>Selected Services</Text>
        {services.map((s) => (
          <View key={s} style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>{'\u2022  '}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14 }}>{s}</Text>
          </View>
        ))}

        <Text style={[heading, { marginTop: 16 }]}>Vehicle Information</Text>
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.grey }}>{label}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
          </View>
        ))}

        {notes.length > 0 && (
          <>
            <Text style={[heading, { marginTop: 16 }]}>Notes</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14 }}>{notes}</Text>
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
        <Pressable
          disabled={submitting}
          onPress={() => router.back()}
          style={{ flex: 1, height: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.greyBorder, alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.5 : 1 }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>Back to Details</Text>
        </Pressable>
        <View style={{ flex: 2 }}>
          <PrimaryButton title="Confirm Appointment" onPress={confirmBooking} loading={submitting} />
        </View>
      </View>
    </ScrollView>
  );
}

const heading = { fontFamily: fonts.bold, fontSize: 13, color: colors.grey, marginBottom: 8 } as const;
