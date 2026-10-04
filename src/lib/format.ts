import type { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const peso = (n: number) => `\u20b1${n.toFixed(2)}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 4, 2026 • 3:05 PM" — port of home_screen.dart's _formatDate. */
export function formatDateTime(raw: unknown): string {
  if (raw == null) return 'Date not set';
  const s = String(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return s;
  const hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ?? '00';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]} \u2022 ${hour12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function appointmentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return colors.statusCompleted;
    case 'in progress':
      return colors.statusInProgress;
    default:
      return colors.statusPending;
  }
}

export function iconForService(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes('oil')) return 'water-outline';
  if (n.includes('brake')) return 'disc-outline';
  if (n.includes('engine')) return 'build-outline';
  if (n.includes('electr')) return 'flash-outline';
  if (n.includes('paint')) return 'color-palette-outline';
  if (n.includes('scan') || n.includes('efi')) return 'hardware-chip-outline';
  if (n.includes('carburator') || n.includes('carburetor')) return 'settings-outline';
  if (n.includes('fog') || n.includes('bacterial')) return 'sparkles-outline';
  return 'construct-outline';
}

export function iconForPartCategory(category: string): IconName {
  switch (category.toLowerCase()) {
    case 'engine':
      return 'settings-outline';
    case 'brakes':
      return 'disc-outline';
    case 'suspension':
      return 'swap-vertical-outline';
    case 'electrical':
      return 'flash-outline';
    default:
      return 'construct-outline';
  }
}
