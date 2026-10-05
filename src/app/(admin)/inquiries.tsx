// Admin > Inquiries. Backend: admin/manage_parts.php (get_inquiries / update_inquiry / delete_inquiry).
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { formatDateTime } from '@/lib/format';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const isResponded = (i: Json) => String(i.status).toLowerCase() === 'responded';

export default function AdminInquiries() {
  const list = useAdminList(() => api.getAdminPartInquiries().then((r) => r.inquiries as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [replyFor, setReplyFor] = useState<Json | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(
    () =>
      list.items.filter(
        (i) =>
          (filter === 'All' || (filter === 'Responded' ? isResponded(i) : !isResponded(i))) &&
          matches(q, i.part_name, i.customer_name, i.customer_email, i.message),
      ),
    [list.items, q, filter],
  );

  async function send() {
    const i = replyFor;
    if (!i) return;
    if (!reply.trim()) return setError('Write a reply first.');
    setError(null);
    const ok = await run(() => api.managePartInquiry({ inquiryId: Number(i.id), action: 'reply', extra: { reply_message: reply.trim() } }), 'Reply sent.');
    if (ok) setReplyFor(null);
  }

  async function remove(i: Json) {
    const ok = await confirm('Delete Inquiry?', 'Remove this inquiry from the list?', { confirmText: 'Delete', destructive: true });
    if (ok) run(() => api.managePartInquiry({ inquiryId: Number(i.id), action: 'delete' }), 'Inquiry deleted.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(i) => String(i.id)}
        emptyIcon="mail-open-outline"
        emptyLabel="No inquiries found."
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search part, customer or message" />
            <FilterChips options={['All', 'Pending', 'Responded']} value={filter} onChange={setFilter} />
          </>
        }
        renderItem={(i) => {
          const done = isResponded(i);
          return (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{i.part_name}</Text>
                <Pill label={done ? 'Responded' : 'Pending'} color={done ? colors.green : '#ED9E00'} />
              </View>
              <Meta icon="person-outline">{i.customer_name || 'Guest'}</Meta>
              <Meta icon="mail-outline">{i.customer_email}</Meta>
              <Meta icon="call-outline">{i.contact}</Meta>
              <Meta icon="time-outline">{i.created_at ? formatDateTime(i.created_at) : ''}</Meta>

              {i.message ? (
                <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.greyLight }}>
                  <Text style={[text.bodyMedium, { color: colors.black }]}>{i.message}</Text>
                </View>
              ) : null}
              {done && i.reply_message ? (
                <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: colors.primaryLight }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.primary, marginBottom: 2 }}>Your reply</Text>
                  <Text style={[text.bodyMedium, { color: colors.black }]}>{i.reply_message}</Text>
                </View>
              ) : null}

              <CardActions>
                <SmallButton
                  label={done ? 'Edit Reply' : 'Reply'}
                  icon="chatbubble-ellipses-outline"
                  tone="primary"
                  disabled={busy}
                  onPress={() => {
                    setError(null);
                    setReply(done ? String(i.reply_message ?? '') : '');
                    setReplyFor(i);
                  }}
                />
                <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(i)} />
              </CardActions>
            </Card>
          );
        }}
      />

      <Sheet visible={replyFor != null} onClose={() => setReplyFor(null)}>
        <Text style={[text.headingSmall, { marginBottom: 4 }]}>Reply to {replyFor?.customer_name || 'Customer'}</Text>
        <Text style={[text.bodyMedium, { marginBottom: 16 }]}>About: {replyFor?.part_name}</Text>
        <Field label="Your reply" value={reply} onChangeText={setReply} placeholder="Type your reply" multiline error={error} />
        <PrimaryButton title="Send Reply" onPress={send} loading={busy} />
      </Sheet>
    </>
  );
}