// Mechanic > Bookings. Backend: get_mechanic_jobs.php (list) + update_job_status.php.
// The backend only lets a mechanic change jobs assigned to them, and emails the
// customer whenever the status changes.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CardActions, FilterChips, ListScreen, PickerSheet, SearchBar, SmallButton, useAdminList, useRunner, matches, type IconName } from '@/components/admin';
import { JobCard, MechanicShell, callPhone, useFocusReload } from '@/components/mechanic';
import { Sheet } from '@/components/Sheet';
import { PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { userSession } from '@/services/session';
import { INSPECTION_COMPONENTS, defaultInspectionResults, saveVehicleInspection, scoreForResults, type InspectionComponent, type InspectionResult, type VehicleCondition } from '@/services/vehicleHealth';
import { colors, fonts, text } from '@/theme/theme';

const STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show'];

// The usual path through a job: one tap to move it forward.
const NEXT: Record<string, { to: string; label: string; icon: IconName }> = {
  Pending: { to: 'Confirmed', label: 'Confirm', icon: 'checkmark-circle-outline' },
  Confirmed: { to: 'In Progress', label: 'Start Job', icon: 'play-circle-outline' },
  'In Progress': { to: 'Completed', label: 'Complete', icon: 'flag-outline' },
};

export default function MechanicBookings() {
  const list = useAdminList(() => api.getMechanicJobs().then((r) => r.jobs as Json[]));
  const { run, busy } = useRunner(list.refresh);
  useFocusReload(list.refresh);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [statusFor, setStatusFor] = useState<Json | null>(null);
  const [inspectionFor, setInspectionFor] = useState<Json | null>(null);

  const data = useMemo(
    () => list.items.filter((j) => (filter === 'All' || j.status === filter) && matches(q, j.customer_name, j.service_type, j.vehicle_brand, j.vehicle_model, j.plate_number)),
    [list.items, q, filter],
  );

  async function setStatus(job: Json, status: string) {
    // Completing / cancelling is hard to undo and emails the customer, so confirm.
    if (status === 'Completed' || status === 'Cancelled' || status === 'No Show') {
      const ok = await confirm('Update Job?', `Mark this job as ${status}? ${job.customer_name ?? 'The customer'} will be notified by email.`, {
        confirmText: `Mark ${status}`,
        destructive: status !== 'Completed',
      });
      if (!ok) return;
    }
    run(() => api.updateJobStatus(Number(job.id), status), `Job marked ${status}.`);
  }

  return (
    <MechanicShell title="Bookings" subtitle={`${list.items.length} assigned job${list.items.length === 1 ? '' : 's'}`}>
      <ListScreen
        list={list}
        data={data}
        keyOf={(j) => String(j.id)}
        emptyIcon="calendar-outline"
        emptyLabel={list.items.length === 0 ? 'No jobs assigned to you yet.' : 'No jobs match.'}
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search customer, service or plate" />
            <FilterChips options={['All', ...STATUSES]} value={filter} onChange={setFilter} />
          </>
        }
        renderItem={(j) => {
          const next = NEXT[String(j.status)];
          return (
            <JobCard job={j}>
              <CardActions>
                {next && <SmallButton label={next.label} icon={next.icon} tone="primary" disabled={busy} onPress={() => setStatus(j, next.to)} />}
                <SmallButton label="Inspect" icon="speedometer-outline" disabled={busy} onPress={() => setInspectionFor(j)} />
                <SmallButton label="Status" icon="swap-horizontal-outline" disabled={busy} onPress={() => setStatusFor(j)} />
                {j.customer_phone ? <SmallButton label="Call" icon="call-outline" onPress={() => callPhone(j.customer_phone)} /> : null}
              </CardActions>
            </JobCard>
          );
        }}
      />

      <PickerSheet
        visible={statusFor != null}
        title="Update Status"
        options={STATUSES.map((s) => ({ value: s, label: s }))}
        value={statusFor?.status}
        onClose={() => setStatusFor(null)}
        onPick={(s) => {
          const j = statusFor;
          setStatusFor(null);
          if (j && s !== j.status) setStatus(j, s);
        }}
      />
      <InspectionSheet job={inspectionFor} onClose={() => setInspectionFor(null)} onSaved={() => { setInspectionFor(null); list.refresh(); }} />
    </MechanicShell>
  );
}

function InspectionSheet({ job, onClose, onSaved }: { job: Json | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [results, setResults] = useState<InspectionResult>(defaultInspectionResults);
  const [notes, setNotes] = useState<Partial<Record<InspectionComponent, string>>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setResults(defaultInspectionResults()); setNotes({}); }, [job?.id]);
  if (!job) return null;
  const vehicle = { vehicle_id: job.vehicle_id, plate_number: job.plate_number, vehicle_brand: job.vehicle_brand, vehicle_model: job.vehicle_model, year: job.vehicle_year };
  const vehicleLabel = [job.vehicle_brand, job.vehicle_model, job.plate_number && `(${job.plate_number})`].filter(Boolean).join(' ') || 'Vehicle';
  const setCondition = (component: InspectionComponent, condition: VehicleCondition) => setResults((current) => ({ ...current, [component]: condition }));
  const save = async () => {
    setSaving(true);
    try {
      const inspection = await saveVehicleInspection({ vehicle, vehicleLabel, appointmentId: String(job.id), mechanicName: userSession.displayName, results, notes });
      toast(`Inspection saved — Vehicle Health: ${inspection.score}%`, 'success');
      onSaved();
    } catch {
      toast('Could not save this inspection. Please try again.', 'error');
    } finally { setSaving(false); }
  };
  return <Sheet visible={job != null} onClose={onClose}>
    <Text style={text.headingSmall}>Vehicle Health Inspection</Text>
    <Text style={[text.bodyMedium, { marginTop: 4 }]}>{job.customer_name || 'Customer'} • {vehicleLabel}</Text>
    <View style={{ marginTop: 14, padding: 13, borderRadius: 12, backgroundColor: colors.primaryLight }}><Text style={text.bodySmall}>AUTOMATIC HEALTH SCORE</Text><Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.primary }}>{scoreForResults(results)}%</Text><Text style={text.bodySmall}>Score is calculated from the selected component conditions.</Text></View>
    <Text style={[text.bodySmall, { marginTop: 16, marginBottom: 4 }]}>This is a maintenance-condition summary, not a mechanical diagnosis.</Text>
    {INSPECTION_COMPONENTS.map((component) => <View key={component} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.greyLight }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, marginBottom: 9 }}>{component}</Text>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {(['Good', 'Needs Attention', 'Critical'] as VehicleCondition[]).map((condition) => {
          const chosen = results[component] === condition;
          const tone = condition === 'Good' ? colors.green : condition === 'Needs Attention' ? '#D97706' : colors.red;
          return <Pressable key={condition} onPress={() => setCondition(component, condition)} style={{ flex: 1, borderRadius: 9, borderWidth: 1, borderColor: chosen ? tone : colors.greyBorder, backgroundColor: chosen ? `${tone}18` : colors.white, paddingVertical: 9, alignItems: 'center' }}><Text style={{ color: chosen ? tone : colors.greyText, fontFamily: fonts.medium, fontSize: 10, textAlign: 'center' }}>{condition}</Text></Pressable>;
        })}
      </View>
      {results[component] !== 'Good' && <TextInput value={notes[component] ?? ''} onChangeText={(value) => setNotes((current) => ({ ...current, [component]: value }))} placeholder={`Optional note about ${component.toLowerCase()}`} placeholderTextColor={colors.grey} multiline style={{ marginTop: 10, minHeight: 54, borderWidth: 1, borderColor: colors.greyBorder, borderRadius: 10, padding: 10, fontFamily: fonts.regular, fontSize: 13, color: colors.black, textAlignVertical: 'top' }} />}
    </View>)}
    <PrimaryButton title="Submit Inspection" onPress={save} loading={saving} style={{ marginTop: 20 }} />
  </Sheet>;
}
