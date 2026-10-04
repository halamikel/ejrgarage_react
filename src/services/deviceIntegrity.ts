// Port of lib/services/device_integrity_service.dart (safe_device -> jail-monkey).
//
// jail-monkey is a native module: it works in a development build / release
// build, but is absent in Expo Go. In that case we fail open, like the Flutter
// version did on error.

export async function isDeviceCompromised(): Promise<boolean> {
  try {
    const JailMonkey = require('jail-monkey').default;
    return Boolean(JailMonkey.isJailBroken());
  } catch (e) {
    console.log('[DeviceIntegrity] Check failed, assuming safe:', e);
    return false;
  }
}
