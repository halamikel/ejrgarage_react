// Mechanic > Customers. Built from the mechanic's own jobs (get_mechanic_jobs.php).
// Tapping a customer loads their completed service history from
// get_customer_history.php, which the backend only serves for customers the
// mechanic has been assigned to.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Card, ListScreen, Meta, Pill, SearchBar, SmallButton, useAdminList, matches } from '@/components/admin';
import { Avatar, MechanicShell, callPhone, jobStatusColor, niceDate, useFocusReload, vehicleOf } from '@/components/mechanic';
import { Sheet } from '@/components/Sheet';
import { ApiException, api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

type Customer = { id: number; name: string; phone: string; pic: string | null; jobs: Json[]; lastDate: string };

function groupCustomers(jobs: Json[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const j of jobs) {
    const key = String(j.user_id ?? j.customer_name);
    const date = String(j.appointment_date ?? '');
    const c: Customer = map.get(key) ?? { id: Number(j.user_id) || 0, name: j.customer_name || 'Customer', phone: j.customer_phone || '', pic: j.customer_profile_picture ?? null, jobs: [], lastDate: '' };
    c.jobs.push(j);
    if (date > c.lastDate) c.lastDate = date;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export default function MechanicCustomers() {
  const list = useAdminList(() => api.getMechanicJobs().then((r) => r.jobs as Json[]));
  useFocusReload(list.refresh);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const customers = useMemo(() => groupCustomers(list.items), [list.items]);
  const data = useMemo(() => customers.filter((c) => matches(q, c.name, c.phone)), [customers, q]);

  return (
    <MechanicShell title="Customers" subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}>
      <ListScreen
        list={list}
        data={data}
        keyOf={(c) => String(c.id || c.name)}
        emptyIcon="people-outline"
        emptyLabel={customers.length === 0 ? 'Customers appear once you have assigned jobs.' : 'No customers match.'}
        header={<SearchBar value={q} onChange={setQ} placeholder="Search name or phone" />}
        renderItem={(c) => {
          const active = c.jobs.filter((j) => ['Pending', 'Confirmed', 'In Progress'].includes(String(j.status))).length;
          return (
            <Pressable onPress={() => setSelected(c)}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={c.name} pic={c.pic} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{c.name}</Text>
                    <Text numberOfLines={1} style={text.bodySmall}>{c.phone || 'No phone on file'}</Text>
                  </View>
                  {active > 0 && <Pill label={`${active} active`} color={colors.primary} />}
                </View>
                <Meta icon="briefcase-outline">{`${c.jobs.length} job${c.jobs.length === 1 ? '' : 's'} \u2022 last ${niceDate(c.lastDate)}`}</Meta>
              </Card>
            </Pressable>
          );
        }}
      />
      <CustomerSheet customer={selected} onClose={() => setSelected(null)} />
    </MechanicShell>
  );
}

function CustomerSheet({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const [history, setHistory] = useState<Json[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = customer?.id;

  useEffect(() => {
    setHistory(null);
    setError(null);
    if (!id) return;
    let cancelled = false;
    api
      .getCustomerHistory(id)
      .then((r) => !cancelled && setHistory(r.history ?? []))
      .catch((e) => !cancelled && setError(e instanceof ApiException ? e.message : 'Could not load history.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Sheet visible={customer != null} onClose={onClose}>
      {customer && (
        <>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Avatar name={customer.name} pic={customer.pic} size={72} />
            <Text style={[text.headingSmall, { marginTop: 10 }]}>{customer.name}</Text>
            {customer.phone ? <Text style={text.bodyMedium}>{customer.phone}</Text> : null}
            {customer.phone ? (
              <View style={{ marginTop: 10 }}>
                <SmallButton label="Call" icon="call-outline" tone="primary" onPress={() => callPhone(customer.phone)} />
              </View>
            ) : null}
          </View>

          <Text style={[text.headingSmall, { marginBottom: 8 }]}>Your jobs</Text>
          {customer.jobs.map((j) => (
            <View key={String(j.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.greyLight }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14 }}>{j.service_type}</Text>
                <Text numberOfLines={1} style={text.bodySmall}>{`${niceDate(j.appointment_date)}${vehicleOf(j) ? `  \u2022  ${vehicleOf(j)}` : ''}`}</Text>
              </View>
              <Pill label={String(j.status)} color={jobStatusColor(String(j.status))} />
            </View>
          ))}

          <Text style={[text.headingSmall, { marginTop: 20, marginBottom: 8 }]}>Completed service history</Text>
          {error ? (
            <Text style={[text.bodyMedium, { color: colors.red }]}>{error}</Text>
          ) : history == null ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : history.length === 0 ? (
            <Text style={text.bodyMedium}>No completed services yet.</Text>
          ) : (
            history.map((h) => (
              <View key={String(h.id)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.greyLight }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14 }}>{h.service_type}</Text>
                <Text style={text.bodySmall}>
                  {[niceDate(h.appointment_date), [h.vehicle_brand, h.vehicle_model].filter(Boolean).join(' '), h.mechanic_name && `by ${h.mechanic_name}`].filter(Boolean).join('  \u2022  ')}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </Sheet>
  );
}