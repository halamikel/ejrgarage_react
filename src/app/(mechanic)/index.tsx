// Mechanic > Home. Backend: get_mechanic_jobs.php, update_availability.php,
// get_my_leave_requests.php, submit_leave_request.php.
// "Available for jobs" is a switch. While on, the mechanic can also mark
// themselves Busy (on_duty) or On Leave (on_break); both stop the admin from
// assigning new jobs. Switching off sets 'unavailable'.
import { Card, Meta, Pill, SmallButton, useAdminList, type IconName } from '@/components/admin';
import { DatePickerModal, startOfDay, ymd } from '@/components/DatePickerModal';
import { JobCard, MechanicShell, dayOf, niceDate, timeOnly, todayKey, useFocusReload, vehicleOf } from '@/components/mechanic';
import { AverageRating, Stars, useAllFeedback } from '@/components/Rating';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Field, PrimaryButton } from '@/components/ui';
import { ApiException, api, type Json } from '@/services/api';
import { statsForAppointments } from '@/services/jobFeedback';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

const SUBSTATES = [
  { value: 'available', label: 'Available', color: colors.green },
  { value: 'on_duty', label: 'Busy', color: colors.blue },
  { value: 'on_break', label: 'On Leave', color: '#ED9E00' },
];
const leaveColor = (s: string) => (s === 'approved' ? colors.green : s === 'rejected' ? colors.red : '#ED9E00');
const ACTIVE = ['Pending', 'Confirmed', 'In Progress'];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function MechanicHome() {
  const toast = useToast();
  const { user, session } = useUserSession();
  const jobs = useAdminList(() => api.getMechanicJobs().then((r) => r.jobs as Json[]));
  const leave = useAdminList(() => api.getMyLeaveRequests().then((r) => r.leave_requests as Json[]));
  const refreshAll = async () => {
    await Promise.all([jobs.refresh(), leave.refresh()]);
  };
  useFocusReload(refreshAll);

  const [saving, setSaving] = useState(false);
  const status = session.mechanicStatus;
  const available = status !== 'unavailable';

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [reason, setReason] = useState('');
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = startOfDay(new Date());
  const oneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  async function setAvailability(next: string) {
    if (next === status || saving) return;
    setSaving(true);
    try {
      await api.updateMechanicAvailability(next);
      if (user) userSession.setUser({ ...user, mechanic_status: next });
      toast(next === 'unavailable' ? 'You are now unavailable for new jobs.' : 'Availability updated.', 'success');
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not update availability.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitLeave() {
    if (!start || !end) return setLeaveError('Pick a start and end date.');
    if (end < start) return setLeaveError('End date cannot be before the start date.');
    setLeaveError(null);
    setSubmitting(true);
    try {
      const res = await api.submitLeaveRequest({ startDate: ymd(start), endDate: ymd(end), reason: reason.trim() });
      toast(res.message ?? 'Leave request submitted.', 'success', 3500);
      setLeaveOpen(false);
      leave.refresh();
    } catch (e) {
      setLeaveError(e instanceof ApiException ? e.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  const all = jobs.items;
  const allFeedback = useAllFeedback();
  const myRating = statsForAppointments(allFeedback, all.map((j) => j.id));
  const todayJobs = all.filter((j) => dayOf(j) === todayKey() && j.status !== 'Cancelled').sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)));
  const upcoming = all
    .filter((j) => dayOf(j) > todayKey() && ACTIVE.includes(String(j.status)))
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)))
    .slice(0, 3);
  const count = (...s: string[]) => all.filter((j) => s.includes(String(j.status))).length;
  const tiles: { label: string; value: number; icon: IconName }[] = [
    { label: 'Today', value: todayJobs.length, icon: 'today-outline' },
    { label: 'To Do', value: count('Pending', 'Confirmed'), icon: 'time-outline' },
    { label: 'In Progress', value: count('In Progress'), icon: 'construct-outline' },
    { label: 'Completed', value: count('Completed'), icon: 'checkmark-done-outline' },
  ];

  return (
    <MechanicShell title={`${greeting()}, ${session.displayName.split(' ')[0]}`} subtitle="Here's your day at the garage.">
      {jobs.loading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={jobs.refreshing} onRefresh={async () => { await Promise.all([jobs.load('pull'), leave.refresh()]); }} tintColor={colors.primary} />}
        >
          {jobs.error ? (
            <Pressable onPress={() => jobs.load()} style={styles.errorBox}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.red }}>{jobs.error} Tap to retry.</Text>
            </Pressable>
          ) : null}

          {/* Availability */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>Available for jobs</Text>
                <Text style={text.bodySmall}>{available ? 'Admins can assign you new jobs.' : "You won't be assigned new jobs."}</Text>
              </View>
              <Switch value={available} disabled={saving} trackColor={{ true: colors.primary, false: colors.greyBorder }} onValueChange={(v) => { setAvailability(v ? 'available' : 'unavailable'); }} />
            </View>
            {available && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {SUBSTATES.map((s) => {
                  const on = status === s.value;
                  return (
                    <Pressable key={s.value} disabled={saving} onPress={() => setAvailability(s.value)} style={[styles.sub, on && { backgroundColor: s.color, borderColor: s.color }]}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? colors.white : colors.greyText }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Customer rating */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>My Customer Rating</Text>
                <View style={{ marginTop: 4 }}><AverageRating stats={myRating} /></View>
              </View>
              {myRating ? <Stars value={myRating.average} size={18} /> : null}
            </View>
          </Card>

          {/* Stats */}
          <View style={styles.grid}>
            {tiles.map((t) => (
              <View key={t.label} style={styles.tile}>
                <View style={styles.bubble}>
                  <Ionicons name={t.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.tileValue}>{t.value}</Text>
                <Text style={text.bodyMedium}>{t.label}</Text>
              </View>
            ))}
          </View>

          {/* Today */}
          <Header title="Today's Jobs" onSeeAll={() => router.push('/(mechanic)/bookings')} />
          {todayJobs.length === 0 ? (
            <Empty label="No jobs scheduled for today." />
          ) : (
            todayJobs.map((j) => (
              <JobCard key={String(j.id)} job={j}>
                {timeOnly(j.appointment_date) ? <Meta icon="alarm-outline">{`At ${timeOnly(j.appointment_date)}`}</Meta> : null}
              </JobCard>
            ))
          )}

          {upcoming.length > 0 && (
            <>
              <Header title="Coming Up" onSeeAll={() => router.push('/(mechanic)/bookings')} />
              {upcoming.map((j) => (
                <Card key={String(j.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14 }}>{j.service_type}</Text>
                    <Text style={text.bodySmall}>{niceDate(j.appointment_date)}</Text>
                  </View>
                  <Meta icon="person-outline">{j.customer_name}</Meta>
                  <Meta icon="car-outline">{vehicleOf(j)}</Meta>
                </Card>
              ))}
            </>
          )}

          {/* Time off */}
          <Header title="Time Off" />
          <SmallButton
            label="Request Time Off"
            icon="airplane-outline"
            tone="primary"
            onPress={() => {
              setStart(null);
              setEnd(null);
              setReason('');
              setLeaveError(null);
              setLeaveOpen(true);
            }}
          />
          <View style={{ height: 12 }} />
          {leave.items.length === 0 ? (
            <Empty label="No time-off requests yet." />
          ) : (
            leave.items.slice(0, 3).map((l) => (
              <Card key={String(l.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14 }}>
                    {l.start_date === l.end_date ? niceDate(l.start_date) : `${niceDate(l.start_date)} \u2013 ${niceDate(l.end_date)}`}
                  </Text>
                  <Pill label={String(l.status).charAt(0).toUpperCase() + String(l.status).slice(1)} color={leaveColor(String(l.status))} />
                </View>
                <Meta icon="document-text-outline">{l.reason}</Meta>
                {l.admin_notes ? <Meta icon="chatbubble-outline">{`Admin: ${l.admin_notes}`}</Meta> : null}
              </Card>
            ))
          )}
        </ScrollView>
      )}

      <Sheet visible={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <Text style={[text.headingSmall, { marginBottom: 4 }]}>Request Time Off</Text>
        <Text style={[text.bodyMedium, { marginBottom: 16 }]}>An admin will review your request.</Text>
        <DateField label="Start date" value={start} onPress={() => setPicking('start')} />
        <DateField label="End date" value={end} onPress={() => setPicking('end')} />
        <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Family event" multiline error={leaveError} />
        <PrimaryButton title="Submit Request" onPress={submitLeave} loading={submitting} />
        {/* Nested so iOS can present it over the open sheet. */}
        <DatePickerModal
          visible={picking != null}
          value={picking === 'end' ? end : start}
          minDate={picking === 'end' && start ? start : today}
          maxDate={oneYear}
          onSelect={(d) => {
            if (picking === 'start') {
              setStart(d);
              if (end && end < d) setEnd(d);
            } else setEnd(d);
          }}
          onClose={() => setPicking(null)}
        />
      </Sheet>
    </MechanicShell>
  );
}

function Header({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
      <Text style={text.headingSmall}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={text.linkText}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, borderRadius: 14, backgroundColor: colors.greyLight }}>
      <Text style={text.bodyMedium}>{label}</Text>
    </View>
  );
}

function DateField({ label, value, onPress }: { label: string; value: Date | null; onPress: () => void }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[text.label, { marginBottom: 8 }]}>{label}</Text>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 12, padding: 16 }}>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: value ? colors.black : colors.grey }}>{value ? niceDate(ymd(value)) : 'Select date'}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.grey} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#FDEEEE', marginBottom: 14 },
  sub: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.greyBorder },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.greyBorder },
  bubble: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileValue: { fontFamily: fonts.bold, fontSize: 26, color: colors.black },
});