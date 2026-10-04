// Port of lib/screens/terms_screen.dart (text copied verbatim).
import { ScrollView, Text, View } from 'react-native';
import { colors, fonts, text } from '@/theme/theme';

const LAST_UPDATED = 'August 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Your Account',
    body: "You must provide accurate, current information when creating an account and keep your login details confidential. You're responsible for all activity that happens under your account, including bookings and orders placed with it.",
  },
  {
    title: '2. Booking Appointments',
    body: "Booking a service through the app reserves a slot but does not guarantee a specific mechanic or exact arrival time — schedules may shift due to workshop demand or vehicle diagnosis. We'll notify you of any status changes (Pending, Confirmed, In Progress, Completed, or Cancelled) via the app, email, or SMS.",
  },
  {
    title: '3. Estimates & Pricing',
    body: "Prices shown in the app are starting estimates only. The final cost depends on your vehicle's condition, parts required, and labor involved, and will be confirmed with you before major work begins.",
  },
  {
    title: '4. Payments',
    body: 'Payments made through the app (including QR/e-wallet payments) are processed for the services or parts you select. Keep your receipt/e-receipt for your records. Refunds, where applicable, are handled on a case-by-case basis.',
  },
  {
    title: '5. Cancellations & No-Shows',
    body: "You may cancel or reschedule an appointment from the app before it's confirmed by our team. Repeated no-shows or late cancellations may affect your ability to book future appointments.",
  },
  {
    title: '6. Parts Orders',
    body: "Availability and pricing of parts listed in the app are subject to change without prior notice. We'll let you know if an item you ordered becomes unavailable so you can choose an alternative or a refund.",
  },
  {
    title: '7. Vehicle Drop-off & Liability',
    body: 'Please remove personal belongings and valuables from your vehicle before drop-off — EJR Garage is not responsible for items left inside. We take reasonable care of every vehicle in our shop, but are not liable for pre-existing issues unrelated to the service performed.',
  },
  {
    title: '8. Communications',
    body: 'By signing up, you agree that we may contact you about your bookings, orders, and account (email, SMS, or in-app notifications) for service-related updates.',
  },
  {
    title: '9. Privacy',
    body: "We collect the information you provide (name, email, phone, vehicle, and booking details) to operate the app and deliver our services. We don't sell your personal information to third parties.",
  },
  {
    title: '10. Changes to These Terms',
    body: 'We may update these terms from time to time. Continuing to use the app after changes take effect means you accept the revised terms.',
  },
  {
    title: '11. Contact Us',
    body: 'Questions about these terms? Reach out to us through the Contact page on our website or the Live Chat feature in this app.',
  },
];

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={text.headingSmall}>EJR Garage</Text>
      <Text style={[text.bodySmall, { marginTop: 4 }]}>Last updated: {LAST_UPDATED}</Text>
      <Text style={[text.bodyMedium, { marginTop: 16, lineHeight: 22 }]}>
        Welcome to EJR Garage. By creating an account or using this app, you agree to the terms below. Please read
        them before signing up.
      </Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ marginTop: 22 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.black }}>{s.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.greyText, marginTop: 6 }}>
            {s.body}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
