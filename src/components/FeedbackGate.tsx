// Mounted once in the customer layout. Whenever a completed appointment has no
// rating yet, it shows the (non-dismissible) RatingSheet until the customer
// rates it. Checks on mount, when the app returns to the foreground, and every
// 30s while the app is open (same polling approach as the mechanic job alerts).
import { RatingSheet } from '@/components/Rating';
import { api, type Json } from '@/services/api';
import { getFeedbackMap, unratedCompleted } from '@/services/jobFeedback';
import { refreshPoints } from '@/services/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const POLL_MS = 30_000;

export function FeedbackGate() {
  const [queue, setQueue] = useState<Json[]>([]);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await api.getQuiet('get_appointments.php');
      const feedback = await getFeedbackMap();
      setQueue(unratedCompleted((res.appointments as Json[]) ?? [], feedback));
      // Points are awarded server-side (e.g. +50 when an appointment is marked
      // Completed), so keep the balance fresh while the app is open.
      await refreshPoints();
    } catch {
      // Offline / server hiccup: try again on the next tick. Never logs the user out.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [check]);

  return (
    <RatingSheet
      appointment={queue[0] ?? null}
      onSubmitted={(f) => setQueue((q) => q.filter((a) => String(a.id) !== f.appointmentId))}
    />
  );
}
