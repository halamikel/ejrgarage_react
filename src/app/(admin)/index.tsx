// Admin dashboard. The original Dart source (lib/screens/admin/admin_dashboard.dart)
// wasn't available, so this is built from the backend contract in
// api/admin/dashboard_stats.php:
//   { stats: { appointments, users, mechanics, orders },
//     today_appointments: [{ id, customer, service, time, status }],
//     recent_orders: [{ id, order_number, customer, total, status }] }
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appointmentStatusColor, peso } from '@/lib/format';
import { ApiException, api, type Json } from '@/services/api';
import { useUserSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TILES: { key: string; label: string; icon: IconName; href: '/(admin)/appointments' | '/(admin)/users' | '/(admin)/mechanics' | '/(admin)/orders' }[] = [
  { key: 'appointments', label: 'Appointments', icon: 'calendar-outline', href: '/(admin)/appointments' },
  { key: 'users', label: 'Users', icon: 'people-outline', href: '/(admin)/users' },
  { key: 'mechanics', label: 'Mechanics', icon: 'hammer-outline', href: '/(admin)/mechanics' },
  { key: 'orders', label: 'Orders', icon: 'cart-outline', href: '/(admin)/orders' },
];

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const orderColor = (s: string) => {
  const v = s.toLowerCase();
  if (v === 'approved' || v === 'completed') return colors.green;
  if (v === 'cancelled') return colors.red;
  return '#ED9E00';
};

export default function AdminDashboard() {
  const { session } = useUserSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Json | null>(null);

  const load = useCallback(async (opts: { pull?: boolean } = {}) => {
    if (opts.pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await api.getAdminDashboardStats());
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load the dashboard. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi-outline" size={32} color={colors.red} />
        <Text style={[text.bodyMedium, { textAlign: 'center', marginVertical: 12 }]}>{error}</Text>
        <Pressable style={styles.outlineBtn} onPress={() => load()}>
          <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const stats: Json = data.stats ?? {};
  const today: Json[] = data.today_appointments ?? [];
  const orders: Json[] = data.recent_orders ?? [];
  const firstName = session.displayName.split(' ')[0];

  return (
    <ScrollView
      style={{ backgroundColor: colors.white }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={colors.primary} />}
    >
      <Text style={text.headingMedium}>Welcome back, {firstName}</Text>
      <Text style={[text.bodyMedium, { marginTop: 2, marginBottom: 20 }]}>Here&apos;s what&apos;s happening at the garage.</Text>

      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable key={t.key} style={styles.tile} onPress={() => router.push(t.href)}>
            <View style={styles.iconBubble}>
              <Ionicons name={t.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileValue}>{Number(stats[t.key] ?? 0)}</Text>
            <Text style={text.bodyMedium}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Today's Appointments" onSeeAll={() => router.push('/(admin)/appointments')} />
      {today.length === 0 ? (
        <Empty icon="calendar-clear-outline" label="No appointments today." />
      ) : (
        today.map((a) => {
          const status = String(a.status ?? 'Pending');
          const c = appointmentStatusColor(status);
          return (
            <View key={String(a.id)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.rowTitle}>{a.customer}</Text>
                <Text numberOfLines={1} style={text.bodySmall}>{`${a.service}  \u2022  ${a.time}`}</Text>
              </View>
              <Pill label={status} color={c} />
            </View>
          );
        })
      )}

      <SectionHeader title="Recent Orders" onSeeAll={() => router.push('/(admin)/orders')} />
      {orders.length === 0 ? (
        <Empty icon="bag-outline" label="No orders yet." />
      ) : (
        orders.map((o) => {
          const status = String(o.status ?? 'pending');
          return (
            <View key={String(o.id)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.rowTitle}>{o.order_number}</Text>
                <Text numberOfLines={1} style={text.bodySmall}>{`${o.customer}  \u2022  ${peso(Number(o.total) || 0)}`}</Text>
              </View>
              <Pill label={cap(status)} color={orderColor(status)} />
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={text.headingSmall}>{title}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8}>
        <Text style={text.linkText}>See all</Text>
      </Pressable>
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

function Empty({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={colors.grey} />
      <Text style={[text.bodyMedium, { marginTop: 8 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.white },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tileValue: { fontFamily: fonts.bold, fontSize: 28, color: colors.black, letterSpacing: -0.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.greyBorder,
  },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.black, marginBottom: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  empty: { alignItems: 'center', paddingVertical: 24, borderRadius: 14, backgroundColor: colors.greyLight },
});