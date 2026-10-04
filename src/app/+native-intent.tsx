// Port of main.dart's app_links handling.
//
// The password-reset email links to
//   https://ejrgarage-staging.onrender.com/reset-password.php?token=...
// (opened via Android App Links / iOS Universal Links, configured in app.json).
// Expo Router would otherwise try to match that URL against a route and show
// "unmatched route", so rewrite it to the in-app /new-password screen.

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (!/reset-password\.php/.test(path)) return path;

  const match = /[?&]token=([^&#]*)/.exec(path);
  const token = match ? decodeURIComponent(match[1]) : '';

  if (token) return `/new-password?token=${encodeURIComponent(token)}`;

  // Reset link without a token: ignore it (Flutter did the same). On a cold
  // start we still have to land somewhere; while running, '' leaves the
  // current screen untouched.
  return initial ? '/' : '';
}
