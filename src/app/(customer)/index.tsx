// Port of _HomeContent in lib/screens/customer/home_screen.dart.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiException, api, type Json } from '@/services/api';
import { appointmentStatusColor, formatDateTime, iconForService } from '@/lib/format';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useUserSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Json[]>([]);
  const [appointments, setAppointments] = useState<Json[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Refresh the cached profile too so the greeting is accurate even when
      // the app restarted straight into Home via splash auto-login.
      const [servicesRes, appointmentsRes, profileRes] = await Promise.all([
        api.getPublic('get_services.php'),
        api.get('get_appointments.php'),
        api.get('get_profile.php'),
      ]);
      if (profileRes.user) userSession.setUser(profileRes.user);
      setServices(((servicesRes.services as Json[]) ?? []).slice(0, 3));
      setAppointments(((appointmentsRes.appointments as Json[]) ?? []).slice(0, 2));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load your dashboard. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Points are awarded server-side (e.g. when an appointment is completed), so
  // re-read the profile whenever Home regains focus to show the latest balance.
  useFocusEffect(
    useCallback(() => {
      api.getProfile().then((r) => r.user && userSession.setUser(r.user)).catch(() => {});
    }, []),
  );

  const goTab = (name: 'parts' | 'booking' | 'chat') => router.navigate(`/(customer)/${name}`);
  const firstName = session.displayName.split(' ')[0];

  const quickActions: { icon: IconName; label: string; color: string; onPress: () => void }[] = [
    { icon: 'book-outline', label: 'Book Now', color: colors.primary, onPress: () => goTab('booking') },
    { icon: 'calendar-outline', label: 'Appointments', color: colors.blue, onPress: () => router.push('/appointments') },
    { icon: 'chatbubble-outline', label: 'Live Chat', color: colors.green, onPress: () => goTab('chat') },
    { icon: 'construct-outline', label: 'Parts', color: '#00897B', onPress: () => goTab('parts') },
    { icon: 'chatbox-ellipses-outline', label: 'Inquiries', color: '#6A5ACD', onPress: () => router.push('/my-inquiries') },
    { icon: 'bag-outline', label: 'My Orders', color: '#D97706', onPress: () => router.push('/my-orders') },
    { icon: 'car-outline', label: 'My Vehicles', color: '#3B7DDB', onPress: () => router.push('/my-vehicles') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.rowBetween}>
          <View>
            <Text style={[text.headingMedium, { fontSize: 22 }]}>Hello, {firstName}! 👋</Text>
            <Text style={[text.bodyMedium, { color: colors.grey, marginTop: 4 }]}>Welcome to EJR Garage</Text>
          </View>
          <View style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color={colors.black} />
          </View>
        </View>

        {/* Read-only search bar that jumps to the Booking tab, like Flutter's */}
        <Pressable style={styles.search} onPress={() => goTab('booking')}>
          <Ionicons name="search" size={22} color={colors.grey} />
          <Text style={[text.bodyMedium, { color: colors.grey, marginLeft: 10 }]}>Search services...</Text>
        </Pressable>

        {/* EJR Points Card */}
        <Pressable style={styles.rewardsCard} onPress={() => router.push('/(customer)/rewards')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardsTitle}>EJR Points</Text>
            <Text style={styles.rewardsSub}>You have <Text style={{ fontFamily: fonts.bold, color: colors.white }}>{session.points} pts</Text></Text>
            <Text style={[styles.rewardsSub, { fontSize: 11, opacity: 0.9, marginTop: 8 }]}>Tap to view benefits & redeem vouchers</Text>
          </View>
          <View style={styles.rewardsIconBg}>
            <Ionicons name="gift" size={32} color={colors.primary} />
          </View>
        </Pressable>

        <Text style={[text.headingSmall, { marginTop: 28, marginBottom: 16 }]}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 22 }}>
          {quickActions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} style={{ alignItems: 'center' }}>
              <View style={[styles.quickIcon, { backgroundColor: `${a.color}1A` }]}>
                <Ionicons name={a.icon} size={28} color={a.color} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, marginTop: 8 }}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.rowBetween, { marginTop: 28, marginBottom: 16 }]}>
          <Text style={text.headingSmall}>Our Services</Text>
          <Pressable onPress={() => goTab('booking')}>
            <Text style={[text.linkText, { fontSize: 13 }]}>See All</Text>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : error ? (
          <InlineError message={error} onRetry={load} />
        ) : services.length === 0 ? (
          <Text style={[text.bodySmall, { paddingVertical: 12 }]}>No services available right now.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {services.map((s, i) => (
              <Pressable key={s.id ?? i} style={styles.card} onPress={() => goTab('booking')}>
                <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name={iconForService(s.name ?? '')} size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{s.name || 'Service'}</Text>
                  <Text style={[text.bodySmall, { marginTop: 4 }]}>{s.description ? s.description : (s.category ?? '')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.grey} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.rowBetween, { marginTop: 28, marginBottom: 16 }]}>
          <Text style={text.headingSmall}>Recent Appointments</Text>
          <Pressable onPress={() => router.push('/appointments')}>
            <Text style={[text.linkText, { fontSize: 13 }]}>See All</Text>
          </Pressable>
        </View>
        {!loading && !error && appointments.length === 0 && (
          <Text style={[text.bodySmall, { paddingVertical: 12 }]}>No appointments yet.</Text>
        )}
        {!loading && !error && appointments.length > 0 && (
          <View style={{ gap: 12 }}>
            {appointments.map((a, i) => {
              const status: string = a.status ?? 'Pending';
              const c = appointmentStatusColor(status);
              return (
                <View key={a.id ?? i} style={styles.card}>
                  <View style={[styles.cardIcon, { backgroundColor: colors.greyLight }]}>
                    <Ionicons name="build" size={24} color={colors.grey} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{a.service_type ? a.service_type : 'Service'}</Text>
                    <Text style={[text.bodySmall, { marginTop: 4 }]}>{formatDateTime(a.appointment_date)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: `${c}1A` }]}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c }}>{status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: colors.red, fontSize: 13, textAlign: 'center', fontFamily: fonts.regular }}>{message}</Text>
      <Pressable onPress={onRetry} style={{ marginTop: 8, padding: 8 }}>
        <Text style={{ color: colors.primary, fontFamily: fonts.medium }}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bell: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.greyBorder, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.greyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  quickIcon: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(224,224,224,0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardIcon: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rewardsCard: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  rewardsTitle: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  rewardsSub: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 4,
  },
  rewardsIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(244,67,54,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.25)',
  },
});