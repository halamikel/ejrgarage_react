// Admin > Services. Backend: admin/manage_services.php (list/add/update/toggle/delete).
import { useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Card, CardActions, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

type Form = { id?: number; name: string; category: string; description: string; price: string; isActive: boolean };
const isActive = (s: Json) => String(s.is_active) !== '0';

export default function AdminServices() {
  const list = useAdminList(() => api.getAdminServices().then((r) => r.services as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => list.items.filter((s) => matches(q, s.name, s.category, s.description)), [list.items, q]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return setError('Service name is required.');
    const price = parseFloat(form.price || '0');
    if (Number.isNaN(price) || price < 0) return setError('Enter a valid starting price.');
    setError(null);
    const f = form;
    const base = { name: f.name.trim(), category: f.category.trim() || 'General', description: f.description.trim(), priceFrom: price };
    const ok = await run(
      () => (f.id == null ? api.addService(base) : api.updateService({ id: f.id, isActive: f.isActive, ...base })),
      f.id == null ? 'Service added.' : 'Service updated.',
    );
    if (ok) setForm(null);
  }

  async function remove(s: Json) {
    const ok = await confirm('Delete Service?', `Delete "${s.name}"? If it has active appointments, deactivate it instead.`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(() => api.deleteService(Number(s.id)), 'Service deleted.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(s) => String(s.id)}
        emptyIcon="construct-outline"
        emptyLabel="No services yet."
        onAdd={() => {
          setError(null);
          setForm({ name: '', category: 'General', description: '', price: '', isActive: true });
        }}
        header={<SearchBar value={q} onChange={setQ} placeholder="Search services" />}
        renderItem={(s) => {
          const active = isActive(s);
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{s.name}</Text>
                  <Pill label={s.category || 'General'} color={colors.primary} />
                </View>
                <Switch
                  value={active}
                  disabled={busy}
                  trackColor={{ true: colors.primary, false: colors.greyBorder }}
                  onValueChange={(v) => {
                    run(() => api.toggleService({ id: Number(s.id), isActive: v }), v ? 'Service activated.' : 'Service deactivated.');
                  }}
                />
              </View>
              {s.description ? <Text style={[text.bodyMedium, { marginTop: 8 }]}>{s.description}</Text> : null}
              <Meta icon="pricetag-outline">{Number(s.price_from) > 0 ? `Starts at ${peso(Number(s.price_from))}` : 'No starting price set'}</Meta>
              <CardActions>
                <SmallButton
                  label="Edit"
                  icon="create-outline"
                  tone="primary"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setForm({
                      id: Number(s.id),
                      name: s.name ?? '',
                      category: s.category ?? 'General',
                      description: s.description ?? '',
                      price: Number(s.price_from) > 0 ? String(Number(s.price_from)) : '',
                      isActive: active,
                    });
                  }}
                />
                <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(s)} />
              </CardActions>
            </Card>
          );
        }}
      />

      <Sheet visible={form != null} onClose={() => setForm(null)}>
        <Text style={[text.headingSmall, { marginBottom: 16 }]}>{form?.id == null ? 'Add Service' : 'Edit Service'}</Text>
        <Field label="Service Name" value={form?.name ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, name: v })} placeholder="e.g. Oil Change" error={error} />
        <Field label="Category" value={form?.category ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, category: v })} placeholder="General" />
        <Field label="Description" value={form?.description ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, description: v })} placeholder="Optional" multiline />
        <Field label="Starting Price (PHP)" value={form?.price ?? ''} onChangeText={(v) => setForm((f) => f && { ...f, price: v.replace(/[^0-9.]/g, '') })} placeholder="0.00" keyboardType="decimal-pad" />
        <PrimaryButton title={form?.id == null ? 'Add Service' : 'Save Changes'} onPress={save} loading={busy} />
      </Sheet>
    </>
  );
}