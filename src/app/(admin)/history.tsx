// Admin > Service History. Backend: admin/get_service_history.php.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { colors, fonts } from '@/theme/theme';

export default function AdminHistory() {
  const list = useAdminList(() => api.getAdminServiceHistory().then((r) => r.history as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');

  const data = useMemo(
    () => list.items.filter((h) => matches(q, h.customer, h.service, h.vehicle, h.plate, h.mechanic)),
    [list.items, q],
  );

  async function remove(h: Json) {
    const ok = await confirm('Delete Record?', 'Delete this service history record? This cannot be undone.', {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) run(() => api.deleteServiceHistory(Number(h.id)), 'Record deleted.');
  }

  return (
    <ListScreen
      list={list}
      data={data}
      keyOf={(h) => String(h.id)}
      emptyIcon="time-outline"
      emptyLabel="No service history yet."
      header={<SearchBar value={q} onChange={setQ} placeholder="Search customer, service, vehicle or plate" />}
      renderItem={(h) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{h.service}</Text>
            <Pill label="Completed" color={colors.green} />
          </View>
          <Meta icon="person-outline">{h.customer}</Meta>
          <Meta icon="car-outline">{[h.vehicle, h.plate].filter((s) => s && s !== 'N/A').join('  \u2022  ') || 'N/A'}</Meta>
          <Meta icon="hammer-outline">{h.mechanic}</Meta>
          <Meta icon="calendar-outline">{h.date}</Meta>
          <CardActions>
            <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(h)} />
          </CardActions>
        </Card>
      )}
    />
  );
}