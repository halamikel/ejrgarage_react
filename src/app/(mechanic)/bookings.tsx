// Mechanic > Bookings. Backend: get_mechanic_jobs.php (list) + update_job_status.php.
// The backend only lets a mechanic change jobs assigned to them, and emails the
// customer whenever the status changes.
import { useMemo, useState } from 'react';
import { CardActions, FilterChips, ListScreen, PickerSheet, SearchBar, SmallButton, useAdminList, useRunner, matches, type IconName } from '@/components/admin';
import { JobCard, MechanicShell, callPhone, useFocusReload } from '@/components/mechanic';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';

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
    </MechanicShell>
  );
}