// Customer feedback + 1-5 star rating for a completed job.
//
// Like vehicleHealth.ts, this persists to on-device storage because the PHP API
// has no feedback endpoints yet. To sync across devices, add authenticated
// endpoints (save + list) and replace readAll()/submitJobFeedback() below while
// keeping the same exported function signatures.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Json } from './api';

export type JobFeedback = {
  appointmentId: string;
  rating: number; // 1..5
  comment: string;
  mechanicName?: string;
  serviceType?: string;
  createdAt: string;
};

const STORAGE_KEY = 'ejr_job_feedback_v1';
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

async function readAll(): Promise<JobFeedback[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getAllFeedback() {
  return readAll();
}

export async function getFeedbackMap(): Promise<Record<string, JobFeedback>> {
  const all = await readAll();
  return Object.fromEntries(all.map((f) => [f.appointmentId, f]));
}

export async function submitJobFeedback(input: {
  appointmentId: string | number;
  rating: number;
  comment?: string;
  mechanicName?: string;
  serviceType?: string;
}) {
  const rating = Math.round(Number(input.rating));
  if (!(rating >= MIN_RATING && rating <= MAX_RATING)) {
    throw new Error('Please choose a rating from 1 to 5 stars.');
  }
  const id = String(input.appointmentId);
  const all = await readAll();
  if (all.some((f) => f.appointmentId === id)) return all.find((f) => f.appointmentId === id)!;
  const feedback: JobFeedback = {
    appointmentId: id,
    rating,
    comment: (input.comment ?? '').trim(),
    mechanicName: input.mechanicName,
    serviceType: input.serviceType,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...all, feedback]));
  return feedback;
}

/** Completed appointments the customer hasn't rated yet, oldest first. */
export function unratedCompleted(appointments: Json[], feedback: Record<string, JobFeedback>): Json[] {
  return appointments
    .filter((a) => String(a.status ?? '').toLowerCase() === 'completed' && a.id != null && !feedback[String(a.id)])
    .sort((a, b) => String(a.appointment_date ?? '').localeCompare(String(b.appointment_date ?? '')));
}

export function averageRating(items: JobFeedback[]) {
  if (items.length === 0) return null;
  return items.reduce((sum, f) => sum + f.rating, 0) / items.length;
}

export type RatingStats = { average: number; count: number };

export function statsFor(items: JobFeedback[]): RatingStats | null {
  const average = averageRating(items);
  return average == null ? null : { average, count: items.length };
}

/** Stats for the feedback attached to the given appointment ids (a mechanic's own jobs). */
export function statsForAppointments(all: JobFeedback[], appointmentIds: unknown[]): RatingStats | null {
  const ids = new Set(appointmentIds.map(String));
  return statsFor(all.filter((f) => ids.has(f.appointmentId)));
}

/** Stats for a mechanic matched by name (case-insensitive) — used by the admin list. */
export function statsForMechanicName(all: JobFeedback[], name: unknown): RatingStats | null {
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return null;
  return statsFor(all.filter((f) => (f.mechanicName ?? '').trim().toLowerCase() === n));
}
