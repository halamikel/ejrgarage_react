// Port of lib/services/user_session.dart.
//
// Tiny in-memory holder for the logged-in user (the "user" object login.php
// returns). Repopulated from get_profile.php on app start when a token is
// stored (see app/index.tsx). Components subscribe via useUserSession().

import { useSyncExternalStore } from 'react';
import { api, ApiService, type Json } from './api';

type Listener = () => void;

class UserSession {
  private _user: Json | null = null;
  private listeners = new Set<Listener>();

  // Arrow-function members so they can be passed straight to useSyncExternalStore.
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => this._user;

  /**
   * True until we've tried to restore the user from the stored token. A web
   * refresh wipes memory but keeps the token, so route guards must wait for
   * this instead of treating "no user yet" as "logged out".
   */
  private _restoring = true;
  get restoring() {
    return this._restoring;
  }
  markRestored() {
    if (!this._restoring) return;
    this._restoring = false;
    this.listeners.forEach((l) => l());
  }

  get user() {
    return this._user;
  }
  setUser(user: Json) {
    this._user = user;
    this.listeners.forEach((l) => l());
  }
  clear() {
    this._user = null;
    this.listeners.forEach((l) => l());
  }

  get displayName(): string {
    return (this._user?.full_name ?? this._user?.name ?? 'Guest') as string;
  }
  get email(): string {
    return (this._user?.email ?? '') as string;
  }
  get points(): number {
    return Number(this._user?.points ?? 0);
  }

  // Role IDs from the EJR Garage PHP backend (1: Customer, 2: Admin, 3: Mechanic).
  // String-compare to be safe against both int and string JSON values.
  get isMechanic() {
    return String(this._user?.role_id) === '3';
  }
  get isAdmin() {
    return String(this._user?.role_id) === '2';
  }
  get isCustomer() {
    return String(this._user?.role_id) === '1';
  }

  get isAvailable() {
    return String(this._user?.is_available ?? '0') !== '0';
  }
  /** 'available' | 'unavailable' | 'on_break' | 'on_duty' */
  get mechanicStatus(): string {
    return (this._user?.mechanic_status as string | undefined) ?? (this.isAvailable ? 'available' : 'unavailable');
  }
  get isOnBreak() {
    return this.mechanicStatus === 'on_break';
  }
  get isOnDuty() {
    return this.mechanicStatus === 'on_duty';
  }

  // profile_picture is either a full Cloudinary URL (new uploads) or a legacy
  // path relative to the site root ("uploads/avatars/avatar_21_....jpg").
  get avatarUrl(): string | null {
    const pic = this._user?.profile_picture as string | undefined;
    if (!pic) return null;
    if (pic.startsWith('http')) return pic;
    const root = ApiService.baseUrl.replace(/api\/?$/, '');
    return `${root}${pic}`;
  }
}

export const userSession = new UserSession();

let restorePromise: Promise<void> | null = null;

/**
 * Loads the logged-in user from the stored token (get_profile.php). Safe to call
 * from several places: the work runs once and everyone shares the result. Never
 * throws; on failure the user simply stays logged out.
 */
export function restoreSession(): Promise<void> {
  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        if (!userSession.user && (await api.isLoggedIn())) {
          const res = await api.getProfile();
          if (res.user) userSession.setUser(res.user);
        }
      } catch (e) {
        console.log('[Session] Could not restore session:', e);
      } finally {
        userSession.markRestored();
      }
    })();
  }
  return restorePromise;
}

/**
 * Quietly re-reads the profile (points are awarded server-side) and updates the
 * session. Returns how many points the balance changed by, or null if the
 * refresh failed. Never throws and never logs the user out.
 */
export async function refreshPoints(): Promise<number | null> {
  try {
    const before = userSession.points;
    const res = await api.getQuiet('get_profile.php');
    if (!res.user) return null;
    userSession.setUser(res.user);
    return userSession.points - before;
  } catch {
    return null;
  }
}

/** Re-renders the component whenever the session user changes. */
export function useUserSession() {
  const user = useSyncExternalStore(userSession.subscribe, userSession.getSnapshot);
  return { user, session: userSession };
}

/** Where to land after login / splash for the current role. */
export function homeRouteForRole(): '/(admin)' | '/(mechanic)' | '/(customer)' {
  if (userSession.isAdmin) return '/(admin)';
  if (userSession.isMechanic) return '/(mechanic)';
  return '/(customer)'; // Flutter's default: anything else gets the customer home
}