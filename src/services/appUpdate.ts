// Port of lib/services/app_update_service.dart.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { ApiService } from './api';

export type UpdateCheckResult = {
  updateRequired: boolean;
  currentVersion: string;
  minRequiredVersion?: string;
  updateMessage?: string;
};

// In a real build this is the binary's version. In Expo Go the "native"
// version is Expo Go's own, so fall back to app.json's version there.
function currentAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

function isVersionLower(current: string, required: string): boolean {
  const parse = (v: string) => v.split('+')[0].split('.').map((p) => parseInt(p, 10) || 0);
  const c = parse(current);
  const r = parse(required);
  const len = Math.max(c.length, r.length);
  for (let i = 0; i < len; i++) {
    const cv = c[i] ?? 0;
    const rv = r[i] ?? 0;
    if (cv !== rv) return cv < rv;
  }
  return false;
}

/** Fails open: any network/parse problem lets the app continue. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = currentAppVersion();
  const ok: UpdateCheckResult = { updateRequired: false, currentVersion };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${ApiService.baseUrl}app_version.php`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return ok;

    const data = (await res.json()) as { min_version?: string; message?: string };
    if (!data.min_version) return ok;

    return {
      updateRequired: isVersionLower(currentVersion, data.min_version),
      currentVersion,
      minRequiredVersion: data.min_version,
      updateMessage: data.message,
    };
  } catch (e) {
    console.log('[AppUpdate] Check failed, allowing app to continue:', e);
    return ok;
  }
}
