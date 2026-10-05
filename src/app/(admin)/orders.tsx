// Admin > Orders. Backend: admin/manage_orders.php (list/update_status/send_receipt/delete).
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Meta, PickerSheet, Pill, SearchBar, SmallButton, cap, useAdminList, useRunner, matches } from '@/components/admin';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { formatDateTime, peso } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

// Same set manage_orders.php accepts.
const STATUSES = ['pending', 'approved', 'shipped', 'delivered', 'completed', 'cancelled'];

const statusColor = (s: string) => {
  switch (s) {
    case 'approved':
    case 'completed':
    case 'delivered':
      return colors.green;
    case 'shipped':
      return colors.blue;
    case 'cancelled':
      return colors.red;
    default:
      return '#ED9E00';
  }
};

const orderNo = (o: Json) => `ORD-${String(o.id).padStart(3, '0')}`;

export default function AdminOrders() {
  const toast = useToast();
  const list = useAdminList(() => api.getAdminOrders().then((r) => r.orders as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [statusFor, setStatusFor] = useState<Json | null>(null);
  const [cancelFor, setCancelFor] = useState<Json | null>(null);
  const [reason, setReason] = useState('');

  const data = useMemo(
    () => list.items.filter((o) => (filter === 'All' || o.status === filter) && matches(q, orderNo(o), o.customer_name, o.contact, o.email)),
    [list.items, q, filter],
  );

  function setStatus(o: Json, status: string, cancellation_reply = '') {
    return run(() => api.manageOrder({ orderId: Number(o.id), action: 'update_status', extra: { status, cancellation_reply } }), `Order ${status}.`);
  }

  async function sendReceipt(o: Json) {
    const ok = await confirm('Send Receipt?', `Email a receipt for ${orderNo(o)} to ${o.email || 'the customer'}?`, { confirmText: 'Send' });
    if (!ok) return;
    run(async () => {
      const res = await api.manageOrder({ orderId: Number(o.id), action: 'send_receipt' });
      toast(res.message ?? 'Receipt sent.', 'success');
    });
  }

  async function remove(o: Json) {
    const ok = await confirm('Archive Order?', `Remove ${orderNo(o)} from the list?`, { confirmText: 'Archive', destructive: true });
    if (ok) run(() => api.manageOrder({ orderId: Number(o.id), action: 'delete' }), 'Order archived.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(o) => String(o.id)}
        emptyIcon="cart-outline"
        emptyLabel="No orders found."
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search order no., customer or contact" />
            <FilterChips options={['All', ...STATUSES]} value={filter} onChange={setFilter} />
          </>
        }
        renderItem={(o) => {
          const status = String(o.status ?? 'pending');
          const items: Json[] = Array.isArray(o.items) ? o.items : [];
          return (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{orderNo(o)}</Text>
                <Pill label={cap(status)} color={statusColor(status)} />
              </View>
              <Meta icon="person-outline">{o.customer_name}</Meta>
              <Meta icon="call-outline">{o.contact}</Meta>
              <Meta icon="location-outline">{o.address}</Meta>
              <Meta icon="time-outline">{o.created_at ? formatDateTime(o.created_at) : ''}</Meta>
              <Meta icon="card-outline">{o.payment_method === 'cod' ? 'Cash on Delivery' : 'Online payment'}</Meta>

              {items.length > 0 && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.greyLight }}>
                  {items.map((it, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <Text numberOfLines={1} style={[text.bodyMedium, { flex: 1, fontSize: 13 }]}>{`${it.qty} \u00D7 ${it.name}`}</Text>
                      <Text style={[text.bodyMedium, { fontSize: 13 }]}>{peso((Number(it.price) || 0) * (Number(it.qty) || 0))}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>Total</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>{peso(Number(o.total_price) || 0)}</Text>
              </View>
              {status === 'cancelled' && o.cancellation_reply ? <Meta icon="chatbubble-outline">{`Reason: ${o.cancellation_reply}`}</Meta> : null}

              <CardActions>
                <SmallButton label="Status" icon="swap-horizontal-outline" tone="primary" disabled={busy} onPress={() => setStatusFor(o)} />
                <SmallButton label="Receipt" icon="mail-outline" disabled={busy} onPress={() => sendReceipt(o)} />
                <SmallButton label="Archive" icon="archive-outline" tone="danger" disabled={busy} onPress={() => remove(o)} />
              </CardActions>
            </Card>
          );
        }}
      />

      <PickerSheet
        visible={statusFor != null}
        title="Update Order Status"
        options={STATUSES.map((s) => ({ value: s, label: cap(s) }))}
        value={statusFor?.status}
        onClose={() => setStatusFor(null)}
        onPick={(s) => {
          const o = statusFor;
          setStatusFor(null);
          if (!o || s === o.status) return;
          if (s === 'cancelled') {
            setReason('');
            setCancelFor(o);
          } else {
            setStatus(o, s);
          }
        }}
      />

      <Sheet visible={cancelFor != null} onClose={() => setCancelFor(null)}>
        <Text style={[text.headingSmall, { marginBottom: 4 }]}>Cancel Order</Text>
        <Text style={[text.bodyMedium, { marginBottom: 16 }]}>Optionally tell the customer why. They&apos;ll see this reason.</Text>
        <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Part is out of stock" multiline />
        <PrimaryButton
          title="Cancel Order"
          loading={busy}
          onPress={async () => {
            const o = cancelFor;
            if (!o) return;
            if (await setStatus(o, 'cancelled', reason.trim())) setCancelFor(null);
          }}
        />
      </Sheet>
    </>
  );
}