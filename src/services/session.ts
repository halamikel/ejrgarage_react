// Port of lib/services/user_session.dart.
//
// Tiny in-memory holder for the logged-in user (the "user" object login.php
// returns). Repopulated from get_profile.php on app start when a token is
// stored (see app/index.tsx). Components subscribe via useUserSession().

import { useSyncExternalStore } from 'react';
import { ApiService, type Json } from './api';

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
