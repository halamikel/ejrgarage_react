# EJR Mobile (Expo)

React Native / Expo port of the Flutter `ejr_mobile` app. See **MIGRATION.md** for what's ported and what's left.

## Feature documentation

- [Vehicle Health](docs/VEHICLE_HEALTH.md) — mechanic inspection workflow, automatic scoring, customer view, and current data-storage behaviour.

## Run it

```bash
npm install
cp .env.example .env        # optional: override the API base URL
npx expo start              # press "a" (Android) or "i" (iOS), or scan the QR with a dev build
```

- **Expo Go** works for everything except the root/jailbreak check (`jail-monkey` is a native module; it fails open in Expo Go).
- For a real device build with all native modules and the password-reset **App Link**:
  ```bash
  npx eas-cli@latest build --profile development --platform android
  ```
- The App Link (`https://ejrgarage-staging.onrender.com/reset-password.php?token=...`) only auto-opens the app once
  `/.well-known/assetlinks.json` on that host contains this build's signing-key SHA-256 (same requirement as the Flutter app).

## Useful commands

```bash
npm run typecheck           # tsc --noEmit
npx expo-doctor             # dependency / config sanity check
```

## Layout

```
src/app/            Expo Router routes (auth screens, + (customer) tabs, (mechanic) tabs, (admin) drawer)
src/services/       api, session, cart, notifications, update check, device integrity
src/components/     shared UI (Field, PrimaryButton, ...)
src/theme/          colors / fonts / text styles
```

The API base URL defaults to `https://ejrgarage.onrender.com/api/` (set `EXPO_PUBLIC_API_BASE_URL` to change it —
the equivalent of Flutter's `--dart-define=API_BASE_URL`).
