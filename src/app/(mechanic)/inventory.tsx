// Mechanic > Inventory. Backend: get_parts.php (public, read-only). Mechanics
// can see what's in stock; parts are edited by admins.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, FilterChips, ListScreen, Pill, SearchBar, cap, useAdminList, matches } from '@/components/admin';
import { MechanicShell, useFocusReload } from '@/components/mechanic';
import { peso } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const LOW = 5;
const stockOf = (p: Json) => Number(p.stock) || 0;

export default function MechanicInventory() {
  const list = useAdminList(() => api.getParts().then((r) => r.parts as Json[]));
  useFocusReload(list.refresh);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');

  const categories = useMemo(
    () => Array.from(new Set(list.items.map((p) => String(p.category ?? '').toLowerCase()).filter(Boolean))).map(cap),
    [list.items],
  );
  const lowCount = list.items.filter((p) => stockOf(p) > 0 && stockOf(p) <= LOW).length;
  const outCount = list.items.filter((p) => stockOf(p) <= 0).length;

  const data = useMemo(
    () =>
      list.items.filter((p) => {
        const s = stockOf(p);
        const byFilter =
          filter === 'All' ||
          (filter === 'Low Stock' ? s > 0 && s <= LOW : filter === 'Out of Stock' ? s <= 0 : String(p.category).toLowerCase() === filter.toLowerCase());
        return byFilter && matches(q, p.name, p.brand, p.category);
      }),
    [list.items, q, filter],
  );

  return (
    <MechanicShell title="Inventory" subtitle={`${list.items.length} parts \u2022 ${lowCount} low \u2022 ${outCount} out of stock`}>
      <ListScreen
        list={list}
        data={data}
        keyOf={(p) => String(p.id)}
        emptyIcon="cube-outline"
        emptyLabel="No parts found."
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search name, brand or category" />
            <FilterChips options={['All', 'Low Stock', 'Out of Stock', ...categories]} value={filter} onChange={setFilter} />
          </>
        }
        renderItem={(p) => {
          const s = stockOf(p);
          const color = s <= 0 ? colors.red : s <= LOW ? '#ED9E00' : colors.green;
          return (
            <Card>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: colors.greyLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <Ionicons name="cube-outline" size={26} color={colors.grey} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{p.name}</Text>
                  {p.brand ? <Text numberOfLines={1} style={text.bodySmall}>{p.brand}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <Pill label={cap(String(p.category ?? 'General'))} color={colors.primary} />
                    <Pill label={s <= 0 ? 'Out of stock' : `${s} in stock`} color={color} />
                  </View>
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{peso(Number(p.price) || 0)}</Text>
              </View>
            </Card>
          );
        }}
      />
    </MechanicShell>
  );
}