// Port of lib/screens/customer/appointment_screen.dart.
import { FeedbackSummary } from '@/components/Rating';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { appointmentStatusColor, formatDateTime } from '@/lib/format';
import { ApiException, api, type Json } from '@/services/api';
import { getFeedbackMap, type JobFeedback } from '@/services/jobFeedback';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function AppointmentsScreen() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Json[]>([]);
  const [selected, setSelected] = useState<Json | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, JobFeedback>>({});

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('get_appointments.php');
      setAppointments((res.appointments as Json[]) ?? []);
      setFeedback(await getFeedbackMap());
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not load appointments. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelAppointment(id: number) {
    const ok = await confirm('Cancel Appointment?', 'Are you sure you want to cancel this appointment? This cannot be undone.', {
      confirmText: 'Yes, cancel it',
      cancelText: 'No',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.cancelAppointment(id);
      setSelected(null);
      toast('Your appointment was cancelled.');
      await load();
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not cancel appointment.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  const message = error ?? (appointments.length === 0 ? 'No appointments yet.' : null);
  if (message) {
    return (
      <View style={styles.center}>
        <Ionicons name={error ? 'alert-circle-outline' : 'calendar-clear-outline'} size={40} color={error ? colors.red : colors.grey} />
        <Text style={[text.bodyMedium, { marginVertical: 12, textAlign: 'center' }]}>{message}</Text>
        {error && (
          <Pressable onPress={() => load()} style={{ padding: 8 }}>
            <Text style={text.linkText}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const status = (a: Json): string => a.status ?? 'Pending';
  const name = (a: Json): string => (a.service_type ? String(a.service_type) : 'Service');

  const sel = selected;
  const selStatus = sel ? status(sel) : '';
  const selColor = appointmentStatusColor(selStatus);
  const selId = sel && sel.id != null ? Number(sel.id) : null;
  const canCancel = selId != null && selStatus.toLowerCase() === 'pending';

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.white }}
        data={appointments}
        keyExtractor={(a, i) => String(a.id ?? i)}
        contentContainerStyle={{ padding: 24 }}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item: a }) => {
          const c = appointmentStatusColor(status(a));
          return (
            <Pressable style={styles.card} onPress={() => setSelected(a)}>
              <View style={styles.thumb}>
                <Ionicons name="construct-outline" size={28} color={colors.grey} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{name(a)}</Text>
                <Text style={[text.bodySmall, { marginTop: 4 }]}>{formatDateTime(a.appointment_date)}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: `${c}1A`, borderWidth: 0.5, borderColor: `${c}4D` }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: c }}>{status(a)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[text.linkText, { fontSize: 12 }]}>View Details</Text>
                    <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Sheet visible={sel != null} onClose={() => !cancelling && setSelected(null)}>
        {sel && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={text.headingSmall}>Appointment Details</Text>
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: `${selColor}1A` }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: selColor }}>{selStatus}</Text>
              </View>
            </View>
            <Row label="Service" value={name(sel)} />
            <Row label="Vehicle" value={String(sel.vehicle_info ?? '').trim() || 'Not specified'} />
            <Row label="Appointment Date" value={formatDateTime(sel.appointment_date)} />
            <Row label="Mechanic" value={sel.mechanic_name ? String(sel.mechanic_name) : 'Not yet assigned'} />
            <Row label="Booked On" value={formatDateTime(sel.created_at)} />
            {selId != null && feedback[String(selId)] && <FeedbackSummary feedback={feedback[String(selId)]} />}

            {canCancel && (
              <Pressable
                disabled={cancelling}
                onPress={() => cancelAppointment(selId!)}
                style={[styles.cancelBtn, cancelling && { opacity: 0.5 }]}
              >
                {cancelling ? <ActivityIndicator size="small" color={colors.red} /> : <Ionicons name="close-circle-outline" size={18} color={colors.red} />}
                <Text style={{ color: colors.red, fontFamily: fonts.semibold }}>{cancelling ? 'Cancelling...' : 'Cancel Appointment'}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setSelected(null)} style={{ alignItems: 'center', padding: 12, marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.medium, color: colors.greyText }}>Close</Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
      <Text style={{ width: 130, fontFamily: fonts.regular, fontSize: 13, color: colors.grey }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.white },
  card: {
    flexDirection: 'row',
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
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.greyLight, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
