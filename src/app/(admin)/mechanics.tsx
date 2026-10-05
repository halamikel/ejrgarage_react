// Admin > Mechanics. Backend: admin/manage_mechanics.php (list/add/update/delete).
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { Select } from '@/components/Select';
import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

// Same four states update_availability.php / manage_mechanics.php accept.
const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'on_break', label: 'On Leave' },
  { value: 'on_duty', label: 'Busy' },
];
const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;
const statusColor = (s: string) =>
  s === 'available' ? colors.green : s === 'on_break' ? '#ED9E00' : s === 'on_duty' ? colors.blue : colors.grey;

type Form = { id?: number; name: string; specialty: string; status: string };

export default function AdminMechanics() {
  const list = useAdminList(() => api.getAdminMechanics().then((r) => r.mechanics as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => list.items.filter((m) => matches(q, m.name, m.specialty)), [list.items, q]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return setError('Name is required.');
    setError(null);
    const f = form;
    const ok = await run(
      () =>
        f.id == null
          ? api.addMechanic({ name: f.name.trim(), specialty: f.specialty.trim() })
          : api.updateMechanic({ id: f.id, name: f.name.trim(), specialty: f.specialty.trim(), status: f.status }),
      f.id == null ? 'Mechanic added.' : 'Mechanic updated.',
    );
    if (ok) setForm(null);
  }

  async function remove(m: Json) {
    const ok = await confirm('Delete Mechanic?', `Delete ${m.name}? Mechanics with active appointments can't be deleted.`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(() => api.deleteMechanic(Number(m.id)), 'Mechanic deleted.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(m) => String(m.id)}
        emptyIcon="hammer-outline"
        emptyLabel="No mechanics yet."
        onAdd={() => {
          setError(null);
          setForm({ name: '', specialty: '', status: 'available' });
        }}
        header={<SearchBar value={q} onChange={setQ} placeholder="Search name or specialty" />}
        renderItem={(m) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{m.name}</Text>
              <Pill label={statusLabel(m.status)} color={statusColor(m.status)} />
            </View>
            <Meta icon="construct-outline">{m.specialty || 'No specialty set'}</Meta>
            <CardActions>
              <SmallButton
                label="Edit"
                icon="create-outline"
                tone="primary"
                disabled={busy}
                onPress={() => {
                  setError(null);
                  setForm({ id: Number(m.id), name: m.name ?? '', specialty: m.specialty ?? '', status: m.status ?? 'available' });
                }}
              />
              <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(m)} />
            </CardActions>
          </Card>
        )}
      />

      <Sheet visible={form != null} onClose={() => setForm(null)}>
        <Text style={[text.headingSmall, { marginBottom: 16 }]}>{form?.id == null ? 'Add Mechanic' : 'Edit Mechanic'}</Text>
        <Field label="Name" value={form?.name ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, name: v })} placeholder="Full name" error={error} />
        <Field label="Specialty" value={form?.specialty ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, specialty: v })} placeholder="e.g. Engine, Brakes" />
        {form?.id != null && <Select label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm((f) => f && { ...f, status: v })} />}
        <PrimaryButton title={form?.id == null ? 'Add Mechanic' : 'Save Changes'} onPress={save} loading={busy} />
      </Sheet>
    </>
  );
}