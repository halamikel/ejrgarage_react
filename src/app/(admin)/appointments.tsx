// Admin > Appointments. Backend: admin/get_full_site_data.php (list),
// admin/update_appointment.php (status), admin/manage_mechanics.php (assign).
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Meta, PickerSheet, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { appointmentStatusColor, formatDateTime } from '@/lib/format';
import { ApiException, api, type Json } from '@/services/api';
import { fonts, text } from '@/theme/theme';

const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show'];

export default function AdminAppointments() {
  const toast = useToast();
  const list = useAdminList(() => api.getAdminAppointments().then((r) => r.appointments as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [statusFor, setStatusFor] = useState<Json | null>(null);
  const [cancelFor, setCancelFor] = useState<Json | null>(null);
  const [reason, setReason] = useState('');
  const [assignFor, setAssignFor] = useState<Json | null>(null);
  const [mechanics, setMechanics] = useState<Json[]>([]);

  const data = useMemo(
    () => list.items.filter((a) => (filter === 'All' || a.status === filter) && matches(q, a.customer, a.service, a.vehicle, a.mechanic)),
    [list.items, q, filter],
  );

  function setStatus(a: Json, status: string, cancellationReply = '') {
    return run(
      () => api.manageAppointment({ appointmentId: Number(a.id), action: 'update_status', extra: { status, cancellation_reply: cancellationReply } }),
      `Marked ${status}.`,
    );
  }

  async function openAssign(a: Json) {
    try {
      const res = await api.getAdminMechanics();
      setMechanics(res.mechanics ?? []);
      setAssignFor(a);
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not load mechanics.', 'error');
    }
  }

  async function remove(a: Json) {
    const ok = await confirm('Delete Appointment?', `Delete ${a.customer}'s ${a.service} appointment? This cannot be undone.`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(() => api.manageAppointment({ appointmentId: Number(a.id), action: 'delete' }), 'Appointment deleted.');
  }

  const statusLabel = (s: string) => (s === 'on_break' ? 'On Leave' : s === 'on_duty' ? 'Busy' : s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(a) => String(a.id)}
        emptyIcon="calendar-outline"
        emptyLabel="No appointments found."
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search customer, service, vehicle or mechanic" />
            <FilterChips options={['All', ...STATUSES]} value={filter} onChange={setFilter} />
          </>
        }
        renderItem={(a) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{a.customer}</Text>
              <Pill label={a.status} color={appointmentStatusColor(a.status)} />
            </View>
            <Meta icon="construct-outline">{a.service}</Meta>
            <Meta icon="car-outline">{a.vehicle}</Meta>
            <Meta icon="calendar-outline">{a.date ? formatDateTime(a.date) : ''}</Meta>
            <Meta icon="hammer-outline">{a.mechanic}</Meta>
            {a.notes ? <Meta icon="document-text-outline">{a.notes}</Meta> : null}
            {a.status === 'Cancelled' && a.cancellation_reply ? <Meta icon="chatbubble-outline">{`Reason: ${a.cancellation_reply}`}</Meta> : null}
            <CardActions>
              <SmallButton label="Status" icon="swap-horizontal-outline" tone="primary" disabled={busy} onPress={() => setStatusFor(a)} />
              {a.status === 'Pending' && <SmallButton label="Assign" icon="person-add-outline" disabled={busy} onPress={() => openAssign(a)} />}
              <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(a)} />
            </CardActions>
          </Card>
        )}
      />

      <PickerSheet
        visible={statusFor != null}
        title="Update Status"
        options={STATUSES.map((s) => ({ value: s, label: s }))}
        value={statusFor?.status}
        onClose={() => setStatusFor(null)}
        onPick={(s) => {
          const a = statusFor;
          setStatusFor(null);
          if (!a || s === a.status) return;
          if (s === 'Cancelled') {
            setReason('');
            setCancelFor(a);
          } else {
            setStatus(a, s);
          }
        }}
      />

      <Sheet visible={cancelFor != null} onClose={() => setCancelFor(null)}>
        <Text style={[text.headingSmall, { marginBottom: 4 }]}>Cancel Appointment</Text>
        <Text style={[text.bodyMedium, { marginBottom: 16 }]}>Optionally tell {cancelFor?.customer ?? 'the customer'} why. They&apos;ll see this reason.</Text>
        <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Fully booked that day" multiline />
        <PrimaryButton
          title="Cancel Appointment"
          loading={busy}
          onPress={async () => {
            const a = cancelFor;
            if (!a) return;
            if (await setStatus(a, 'Cancelled', reason.trim())) setCancelFor(null);
          }}
        />
      </Sheet>

      <PickerSheet
        visible={assignFor != null}
        title="Assign Mechanic"
        options={[
          { value: '0', label: 'Unassigned' },
          ...mechanics.map((m) => ({ value: String(m.id), label: `${m.name}  (${statusLabel(String(m.status))})` })),
        ]}
        value={assignFor?.mechanic_id ? String(assignFor.mechanic_id) : '0'}
        onClose={() => setAssignFor(null)}
        onPick={(id) => {
          const a = assignFor;
          setAssignFor(null);
          if (a) run(() => api.manageAppointment({ appointmentId: Number(a.id), action: 'assign_mechanic', extra: { mechanic_id: Number(id) } }), id === '0' ? 'Mechanic unassigned.' : 'Mechanic assigned.');
        }}
      />
    </>
  );
}