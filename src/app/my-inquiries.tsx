// Port of lib/screens/customer/my_inquiries_screen.dart.
// Backend: get_inquiries.php (the logged-in customer's part inquiries).
// Inquiries are created from the Parts screen; the admin's reply appears here.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, FilterChips, ListScreen, Meta, Pill, useAdminList } from '@/components/admin';
import { formatDateTime } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const isResponded = (i: Json) => String(i.status).toLowerCase() === 'responded';

export default function MyInquiriesScreen() {
  const list = useAdminList(() => api.getMyInquiries().then((r) => r.inquiries as Json[]));
  const [filter, setFilter] = useState('All');

  const data = list.items.filter((i) => filter === 'All' || (filter === 'Replied' ? isResponded(i) : !isResponded(i)));

  return (
    <ListScreen
      list={list}
      data={data}
      keyOf={(i) => String(i.id)}
      emptyIcon="chatbox-ellipses-outline"
      emptyLabel={list.items.length === 0 ? 'No inquiries yet. Ask about a part from the Parts tab.' : 'No inquiries in this view.'}
      header={list.items.length > 0 ? <FilterChips options={['All', 'Pending', 'Replied']} value={filter} onChange={setFilter} /> : null}
      renderItem={(i) => {
        const done = isResponded(i);
        return (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{i.part_name || 'Part inquiry'}</Text>
              <Pill label={done ? 'Replied' : 'Pending'} color={done ? colors.green : '#ED9E00'} />
            </View>
            <Meta icon="time-outline">{i.created_at ? formatDateTime(i.created_at) : ''}</Meta>

            {i.message ? (
              <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.greyLight }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.greyText, marginBottom: 2 }}>Your message</Text>
                <Text style={[text.bodyMedium, { color: colors.black }]}>{i.message}</Text>
              </View>
            ) : null}

            {!done ? (
              <Text style={[text.bodySmall, { marginTop: 10 }]}>We&apos;ll reply as soon as we can. You&apos;ll see it here.</Text>
            ) : i.reply_message ? (
              <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.primary, marginBottom: 2 }}>Reply from EJR Garage</Text>
                <Text style={[text.bodyMedium, { color: colors.black }]}>{i.reply_message}</Text>
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}