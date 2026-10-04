// Port of lib/screens/customer/my_orders_screen.dart.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { ApiException, api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const statusColor = (s: string) => (s === 'approved' ? colors.green : s === 'cancelled' ? colors.red : '#ED9E00');
const statusBg = (s: string) => (s === 'approved' ? '#D1F3DF' : s === 'cancelled' ? '#FDE2E2' : '#FFF3CD');

export default function MyOrdersScreen() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Json[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(async (opts: { pull?: boolean } = {}) => {
    if (opts.pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.getMyOrders();
      setOrders((res.orders as Json[]) ?? []);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load orders. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(orderId: number) {
    const ok = await confirm('Cancel Order?', 'Are you sure you want to cancel this order? This cannot be undone.', {
      confirmText: 'Yes, cancel it',
      cancelText: 'No',
      destructive: true,
    });
    if (!ok) return;
    setCancellingId(orderId);
    try {
      await api.cancelOrder(orderId);
      toast('Your order was cancelled.');
      await load();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not cancel order.');
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  if (error) {
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

  return (
    <FlatList
      style={{ backgroundColor: colors.white }}
      data={orders}
      keyExtractor={(o) => String(o.id)}
      contentContainerStyle={{ padding: 20, flexGrow: 1 }}
      refreshing={refreshing}
      onRefresh={() => load({ pull: true })}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="bag-outline" size={40} color={colors.grey} />
          <Text style={[text.bodyMedium, { marginTop: 12 }]}>No orders yet.</Text>
        </View>
      }
      renderItem={({ item }) => <OrderCard order={item} cancelling={cancellingId === Number(item.id)} onCancel={cancel} />}
    />
  );
}

function OrderCard({ order, cancelling, onCancel }: { order: Json; cancelling: boolean; onCancel: (id: number) => void }) {
  const id = Number(order.id);
  const orderNo = order.user_order_number ?? id;
  const status: string = order.status ?? 'pending';
  const paymentStatus: string | undefined = order.payment_status;
  const paymentMethod: string | undefined = order.payment_method;
  const total = parseFloat(String(order.total_price ?? 0)) || 0;
  const items: Json[] = order.items ?? [];
  const isPaid = paymentStatus === 'paid';
  const payLabel = isPaid ? 'Paid' : paymentMethod === 'cod' ? 'Cash on Delivery' : 'Unpaid';
  const payIcon = isPaid ? 'checkmark-circle' : paymentMethod === 'cod' ? 'cash-outline' : 'time-outline';
  const payColor = isPaid ? '#0A4A9E' : colors.greyText;

  return (
    <View style={styles.card} testID={`order_card_${id}`}>
      <View style={styles.rowBetween}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14 }}>Order #{orderNo}</Text>
        <View style={[styles.pill, { backgroundColor: statusBg(status) }]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: statusColor(status) }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
      </View>
      {order.created_at ? <Text style={[text.bodySmall, { marginTop: 4, marginBottom: 10 }]}>{order.created_at}</Text> : null}

      {items.map((m, i) => {
        const qty = Number(m.qty ?? 1);
        const price = parseFloat(String(m.price ?? 0)) || 0;
        return (
          <View key={i} style={[styles.rowBetween, { marginBottom: 4 }]}>
            <Text numberOfLines={1} style={[text.bodyMedium, { flex: 1 }]}>{`${m.name ?? ''}  x${qty}`}</Text>
            <Text style={text.bodyMedium}>{peso(price * qty)}</Text>
          </View>
        );
      })}

      <View style={styles.divider} />
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={payIcon} size={15} color={payColor} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: payColor }}>{payLabel}</Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>{peso(total)}</Text>
      </View>

      {status === 'pending' && (
        <Pressable style={[styles.cancelBtn, cancelling && { opacity: 0.5 }]} disabled={cancelling} onPress={() => onCancel(id)}>
          {cancelling ? <ActivityIndicator size="small" color={colors.red} /> : <Ionicons name="close-circle-outline" size={16} color={colors.red} />}
          <Text style={{ color: colors.red, fontFamily: fonts.semibold, fontSize: 13 }}>{cancelling ? 'Cancelling...' : 'Cancel Order'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  card: {
    padding: 16,
    marginBottom: 14,
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  divider: { height: 1, backgroundColor: colors.greyBorder, marginVertical: 12 },
  cancelBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
