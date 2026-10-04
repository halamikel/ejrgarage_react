// expo-secure-store has no web implementation (its native module is missing in
// the browser), so route through this wrapper. Native: Keychain / Keystore.
// Web: localStorage — NOT encrypted, so it's only meant for developing in the
// browser; ship the phone builds for real use.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (e.g. private mode)
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return isWeb ? (ls()?.getItem(key) ?? null) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) ls()?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) ls()?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
