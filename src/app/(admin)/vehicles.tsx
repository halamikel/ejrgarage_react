// Admin > Vehicles. Backend: admin/manage_vehicles.php.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { colors, fonts } from '@/theme/theme';

export default function AdminVehicles() {
  const list = useAdminList(() => api.getAdminVehicles().then((r) => r.vehicles as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');

  const data = useMemo(
    () => list.items.filter((v) => matches(q, v.owner, v.brand, v.model, v.plate, v.year)),
    [list.items, q],
  );

  async function remove(v: Json) {
    const ok = await confirm('Delete Vehicle?', `Delete ${v.brand} ${v.model} (${v.plate})? This cannot be undone.`, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(() => api.deleteVehicle(Number(v.id)), 'Vehicle deleted.');
  }

  return (
    <ListScreen
      list={list}
      data={data}
      keyOf={(v) => String(v.id)}
      emptyIcon="car-outline"
      emptyLabel="No vehicles found."
      header={<SearchBar value={q} onChange={setQ} placeholder="Search owner, brand, model or plate" />}
      renderItem={(v) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{`${v.brand} ${v.model}`.trim()}</Text>
            <Pill label={String(v.plate).toUpperCase()} color={colors.primary} />
          </View>
          <Meta icon="person-outline">{v.owner}</Meta>
          <Meta icon="calendar-outline">{v.year ? `Year ${v.year}` : ''}</Meta>
          <Meta icon="cog-outline">{[v.transmission, v.fuel].filter(Boolean).join('  \u2022  ')}</Meta>
          <CardActions>
            <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(v)} />
          </CardActions>
        </Card>
      )}
    />
  );
}