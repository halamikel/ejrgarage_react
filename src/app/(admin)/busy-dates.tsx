// Admin > Busy Dates. Backend: admin/manage_busy_dates.php (list/block/toggle_busy/delete).
// A "busy" date can't be picked by customers in the booking flow.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Meta, Pill, SmallButton, useAdminList, useRunner } from '@/components/admin';
import { DatePickerModal, startOfDay, ymd } from '@/components/DatePickerModal';
import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton } from '@/components/ui';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYmd(s: string): Date {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const niceDate = (d: Date) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

export default function AdminBusyDates() {
  const list = useAdminList(() => api.getAdminBusyDates().then((r) => r.dates as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [view, setView] = useState('Upcoming');
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [limit, setLimit] = useState('5');
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const oneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const data = useMemo(() => {
    const t = ymd(today);
    return list.items.filter((r) => {
      const day = String(r.appointment_date).slice(0, 10);
      return view === 'All' || (view === 'Upcoming' ? day >= t : day < t);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.items, view]);

  async function block() {
    if (!date) return setError('Pick a date to block.');
    const n = parseInt(limit, 10);
    if (Number.isNaN(n) || n < 0) return setError('Enter a valid booking limit.');
    setError(null);
    const ok = await run(() => api.blockBusyDate({ date: ymd(date), limit: n }), 'Date blocked.');
    if (ok) {
      setAdding(false);
      setDate(null);
    }
  }

  async function remove(r: Json) {
    const ok = await confirm('Remove Date?', `Remove ${niceDate(parseYmd(r.appointment_date))} from the list?`, {
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) run(() => api.deleteBusyDate(Number(r.id)), 'Date removed.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(r) => String(r.id)}
        emptyIcon="calendar-clear-outline"
        emptyLabel={view === 'Upcoming' ? 'No upcoming busy dates.' : 'Nothing here.'}
        onAdd={() => {
          setError(null);
          setDate(null);
          setLimit('5');
          setAdding(true);
        }}
        header={<FilterChips options={['Upcoming', 'Past', 'All']} value={view} onChange={setView} />}
        renderItem={(r) => {
          const isBusy = Number(r.is_busy) === 1;
          return (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{niceDate(parseYmd(r.appointment_date))}</Text>
                <Pill label={isBusy ? 'Busy' : 'Open'} color={isBusy ? colors.red : colors.green} />
              </View>
              <Meta icon="people-outline">{`${Number(r.current_bookings) || 0} of ${Number(r.slot_limit) || 0} slots booked`}</Meta>
              <CardActions>
                <SmallButton
                  label={isBusy ? 'Mark Open' : 'Mark Busy'}
                  icon={isBusy ? 'lock-open-outline' : 'lock-closed-outline'}
                  tone="primary"
                  disabled={busy}
                  onPress={() =>
                    run(
                      () => api.post('admin/manage_busy_dates.php', { action: 'toggle_busy', id: Number(r.id), is_busy: isBusy ? 0 : 1 }),
                      isBusy ? 'Date is open for booking.' : 'Date marked busy.',
                    )
                  }
                />
                <SmallButton label="Remove" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(r)} />
              </CardActions>
            </Card>
          );
        }}
      />

      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <Text style={[text.headingSmall, { marginBottom: 4 }]}>Block a Date</Text>
        <Text style={[text.bodyMedium, { marginBottom: 16 }]}>Customers won&apos;t be able to book this date.</Text>

        <Text style={[text.label, { marginBottom: 8 }]}>Date</Text>
        <Pressable
          onPress={() => setPicking(true)}
          style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 12, padding: 16, marginBottom: 20 }}
        >
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: date ? colors.black : colors.grey }}>{date ? niceDate(date) : 'Select date'}</Text>
          <Ionicons name="calendar-outline" size={20} color={colors.grey} />
        </Pressable>

        <Field label="Booking Limit" value={limit} onChangeText={(v) => setLimit(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="5" error={error} />
        <PrimaryButton title="Block Date" onPress={block} loading={busy} />
        {/* Nested so iOS can present it over the open sheet. */}
        <DatePickerModal visible={picking} value={date} minDate={today} maxDate={oneYear} onSelect={setDate} onClose={() => setPicking(false)} />
      </Sheet>
    </>
  );
}