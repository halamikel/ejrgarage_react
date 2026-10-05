// Shared pieces for the mechanic tabs (they have no navigation header, so each
// screen draws its own title), plus the job card used on Home and Bookings.
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Meta, Pill } from '@/components/admin';
import { appointmentStatusColor, formatDateTime } from '@/lib/format';
import { ApiService, type Json } from '@/services/api';
import { colors, fonts, text } from '@/theme/theme';

export function MechanicShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={text.headingMedium}>{title}</Text>
        {subtitle ? <Text style={[text.bodyMedium, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </SafeAreaView>
  );
}

/**
 * Tabs stay mounted, so data would go stale (e.g. a job completed on Bookings
 * still shown as In Progress on Home). Silently reload whenever the tab regains
 * focus. The first focus is skipped because useAdminList already loads on mount.
 */
export function useFocusReload(refresh: () => Promise<void> | void) {
  const first = useRef(true);
  // Keep the latest callback in a ref so the focus effect below stays stable.
  // A callback that changes identity every render would re-fire the effect after
  // each render -> refresh -> re-render, looping requests forever.
  const latest = useRef(refresh);
  latest.current = refresh;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current();
    }, []),
  );
}

// profile_picture is a full URL (Cloudinary) or a legacy path relative to the site root.
export function avatarUrl(pic?: string | null): string | null {
  if (!pic) return null;
  if (pic.startsWith('http')) return pic;
  return `${ApiService.baseUrl.replace(/api\/?$/, '')}${pic}`;
}

export function Avatar({ name, pic, size = 40 }: { name: string; pic?: string | null; size?: number }) {
  const uri = avatarUrl(pic);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.4, color: colors.primary }}>{String(name || '?').charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

export function callPhone(phone?: string | null) {
  if (!phone) return;
  Linking.openURL(`tel:${String(phone).replace(/\s+/g, '')}`).catch(() => {});
}

export const jobStatusColor = (s: string) => {
  const v = s.toLowerCase();
  if (v === 'cancelled' || v === 'no show') return colors.red;
  if (v === 'confirmed') return colors.blue;
  return appointmentStatusColor(s);
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD...' -> 'Oct 5, 2026' */
export function niceDate(raw: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? ''));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : String(raw ?? '');
}
/** '... 14:30:00' -> '2:30 PM' (empty if the value has no time part) */
export function timeOnly(raw: unknown): string {
  const m = /[ T](\d{2}):(\d{2})/.exec(String(raw ?? ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dayOf = (job: Json) => String(job.appointment_date ?? '').slice(0, 10);

export const vehicleOf = (j: Json) => {
  const name = [j.vehicle_brand, j.vehicle_model].filter(Boolean).join(' ');
  return [name, j.plate_number].filter(Boolean).join('  \u2022  ');
};

/** One assigned job. Pass action buttons as children. */
export function JobCard({ job, children }: { job: Json; children?: ReactNode }) {
  const status = String(job.status ?? 'Pending');
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={job.customer_name ?? '?'} pic={job.customer_profile_picture} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{job.customer_name || 'Customer'}</Text>
        <Pill label={status} color={jobStatusColor(status)} />
      </View>
      <Meta icon="construct-outline">{job.service_type}</Meta>
      <Meta icon="car-outline">{vehicleOf(job)}</Meta>
      <Meta icon="calendar-outline">{job.appointment_date ? formatDateTime(job.appointment_date) : ''}</Meta>
      {children}
    </Card>
  );
}
