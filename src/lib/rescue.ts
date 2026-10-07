// Roadside-rescue contact. Defaults to the garage's rescue number below; set
// EXPO_PUBLIC_RESCUE_NUMBER in .env to override it without touching code.
// Expo inlines EXPO_PUBLIC_* values at build time, so restart the dev server /
// rebuild after changing it.
import { Linking, Platform } from 'react-native';

const DEFAULT_RESCUE_NUMBER = '09067045422';

export const RESCUE_NUMBER = (process.env.EXPO_PUBLIC_RESCUE_NUMBER || DEFAULT_RESCUE_NUMBER).replace(/[^\d+]/g, '');
export const hasRescueNumber = RESCUE_NUMBER.length > 0;

/** Opens the phone's dialer with the rescue number already filled in. */
export function openRescueDialer(): Promise<void> {
  return Linking.openURL(`tel:${RESCUE_NUMBER}`);
}

/** Opens the phone's messaging app addressed to the rescue number, with `body` pre-typed. */
export function openRescueMessage(body: string): Promise<void> {
  // iOS separates the body with "&", Android with "?".
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return Linking.openURL(`sms:${RESCUE_NUMBER}${sep}body=${encodeURIComponent(body)}`);
}
