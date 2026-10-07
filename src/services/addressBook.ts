// Delivery profiles for checkout: who the order is for + where it goes.
//
// - "My Profile" (id 'account') is built from the logged-in user (name, phone,
//   address). The server stores the address as one string, so it is split with
//   parseAddress(). If the customer completes/fixes it in the cart, the
//   structured version is kept on this device as an override (it is dropped
//   automatically if the profile address is later changed from Edit Profile).
// - Any extra profiles the customer adds while ordering are saved on this
//   device, per user, in AsyncStorage (no backend support is needed).
import { parseAddress, type ShippingAddress } from '@/lib/address';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useUserSession } from './session';

export const ACCOUNT_PROFILE_ID = 'account';

export type DeliveryProfile = {
  id: string;
  label: string;
  name: string;
  contact: string;
  address: ShippingAddress;
  /** true only for the virtual "My Profile" entry */
  isAccount?: boolean;
};

export type ProfileInput = Omit<DeliveryProfile, 'id' | 'isAccount'>;

type AccountOverride = ProfileInput & { sourceAddress: string };
type Stored = { saved: DeliveryProfile[]; accountOverride: AccountOverride | null };

const KEY_PREFIX = 'ejr_delivery_profiles:';
const EMPTY: Stored = { saved: [], accountOverride: null };

/** Stored as 63XXXXXXXXXX; show the familiar 09XXXXXXXXX. */
function toLocalPhone(raw: unknown): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('63') ? `0${d.slice(2)}` : d;
}

class AddressBook {
  private state: Stored = EMPTY;
  private userKey: string | null = null;
  private listeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => this.state;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    if (!this.userKey) return;
    AsyncStorage.setItem(KEY_PREFIX + this.userKey, JSON.stringify(this.state)).catch((e) =>
      console.warn('[addressBook] failed to persist:', e),
    );
  }

  /** Loads the book for this user (switching accounts swaps the data). */
  async load(userKey: string) {
    if (this.userKey === userKey) return;
    this.userKey = userKey;
    this.state = EMPTY;
    this.emit();
    try {
      const raw = await AsyncStorage.getItem(KEY_PREFIX + userKey);
      if (raw && this.userKey === userKey) {
        const parsed = JSON.parse(raw) as Partial<Stored>;
        this.state = {
          saved: Array.isArray(parsed.saved) ? parsed.saved : [],
          accountOverride: parsed.accountOverride ?? null,
        };
        this.emit();
      }
    } catch {
      // corrupt/unavailable storage -> start empty
    }
  }

  add(input: ProfileInput): DeliveryProfile {
    const profile: DeliveryProfile = { ...input, id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    this.state = { ...this.state, saved: [...this.state.saved, profile] };
    this.persist();
    this.emit();
    return profile;
  }

  update(id: string, input: ProfileInput) {
    this.state = { ...this.state, saved: this.state.saved.map((p) => (p.id === id ? { ...p, ...input } : p)) };
    this.persist();
    this.emit();
  }

  remove(id: string) {
    this.state = { ...this.state, saved: this.state.saved.filter((p) => p.id !== id) };
    this.persist();
    this.emit();
  }

  saveAccountOverride(input: ProfileInput, sourceAddress: string) {
    this.state = { ...this.state, accountOverride: { ...input, sourceAddress } };
    this.persist();
    this.emit();
  }
}

export const addressBook = new AddressBook();

/** All delivery profiles for the logged-in user: "My Profile" first, then saved ones. */
export function useDeliveryProfiles() {
  const { user } = useUserSession();
  const state = useSyncExternalStore(addressBook.subscribe, addressBook.getSnapshot);
  const userKey = String(user?.id ?? user?.user_id ?? user?.email ?? 'guest');

  useEffect(() => {
    addressBook.load(userKey);
  }, [userKey]);

  const rawAddress = String(user?.address ?? '').trim();

  const profiles = useMemo<DeliveryProfile[]>(() => {
    const override = state.accountOverride && state.accountOverride.sourceAddress === rawAddress ? state.accountOverride : null;
    const account: DeliveryProfile = {
      id: ACCOUNT_PROFILE_ID,
      label: 'My Profile',
      isAccount: true,
      name: override?.name ?? String(user?.full_name ?? user?.name ?? ''),
      contact: override?.contact ?? toLocalPhone(user?.phone),
      address: override?.address ?? parseAddress(rawAddress),
    };
    return [account, ...state.saved];
  }, [state, rawAddress, user?.full_name, user?.name, user?.phone]);

  const add = useCallback((input: ProfileInput) => addressBook.add(input), []);
  const update = useCallback((id: string, input: ProfileInput) => {
    if (id === ACCOUNT_PROFILE_ID) addressBook.saveAccountOverride(input, rawAddress);
    else addressBook.update(id, input);
  }, [rawAddress]);
  const remove = useCallback((id: string) => addressBook.remove(id), []);

  return { profiles, add, update, remove };
}
