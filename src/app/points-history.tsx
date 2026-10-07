// Points history: every EJR point earned (+) and spent (-), newest first.
import { ApiException, api, type Json } from '@/services/api';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

type Entry = { id: number; points: number; reason: string; label: string; created_at: string };

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  appointment: 'calendar',
  parts_order: 'cart',
  review: 'star',
  redeem: 'pricetag',
};

function formatWhen(raw: string) {
  const [datePart, timePart] = String(raw ?? '').split(' ');
  const [y, m, d] = (datePart ?? '').split('-');
  if (!y || !m || !d) return String(raw ?? '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}${timePart ? ` • ${timePart.slice(0, 5)}` : ''}`;
}

export default function PointsHistoryScreen() {
  useUserSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [earned, setEarned] = useState(0);
  const [spent, setSpent] = useState(0);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res: Json = await api.getPointsHistory();
      setHistory((res.history as Entry[]) ?? []);
      setEarned(Number(res.total_earned ?? 0));
      setSpent(Number(res.total_spent ?? 0));
      // The endpoint also credits any missed points, so keep the shown balance in sync.
      if (res.balance != null && userSession.user) {
        userSession.setUser({ ...userSession.user, points: Number(res.balance) });
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load points history. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.white }}
      data={history}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={{ padding: 20, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={styles.summary}>
          <Text style={styles.balLabel}>Current Balance</Text>
          <Text style={styles.balValue}>{userSession.points} pts</Text>
          <View style={styles.totals}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Earned</Text>
              <Text style={[styles.totalValue, { color: '#A5F3B5' }]}>+{earned}</Text>
            </View>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Spent</Text>
              <Text style={[styles.totalValue, { color: '#FFD0D0' }]}>-{spent}</Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name={error ? 'alert-circle-outline' : 'time-outline'} size={40} color={error ? colors.red : colors.grey} />
          <Text style={[text.bodyMedium, { color: colors.grey, marginTop: 10, textAlign: 'center' }]}>
            {error ?? 'No points activity yet. Complete an appointment to start earning!'}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const gain = item.points > 0;
        return (
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: gain ? '#E8F7EC' : '#FDECEC' }]}>
              <Ionicons name={ICONS[item.reason] ?? 'ellipse'} size={18} color={gain ? '#2E9E4F' : colors.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
              <Text style={styles.when}>{formatWhen(item.created_at)}</Text>
            </View>
            <Text style={[styles.pts, { color: gain ? '#2E9E4F' : colors.red }]}>
              {gain ? '+' : ''}{item.points}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 16 },
  balLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.regular, fontSize: 13 },
  balValue: { color: colors.white, fontFamily: fonts.bold, fontSize: 32, marginTop: 2 },
  totals: { flexDirection: 'row', gap: 12, marginTop: 14 },
  totalBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.regular, fontSize: 12 },
  totalValue: { fontFamily: fonts.bold, fontSize: 20, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.black },
  when: { fontFamily: fonts.regular, fontSize: 12, color: colors.grey, marginTop: 2 },
  pts: { fontFamily: fonts.bold, fontSize: 16 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
