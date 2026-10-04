// Port of lib/services/payment_preference_service.dart.
import * as SecureStore from 'expo-secure-store';

const METHOD_KEY = 'last_payment_method'; // 'online' | 'cod'
const SUB_METHOD_KEY = 'last_payment_submethod'; // 'card' | 'qrph'

export const paymentPreference = {
  async save(args: { method: string; subMethod?: string }) {
    await SecureStore.setItemAsync(METHOD_KEY, args.method);
    if (args.subMethod != null) await SecureStore.setItemAsync(SUB_METHOD_KEY, args.subMethod);
  },
  async load(): Promise<{ method: string | null; subMethod: string | null }> {
    const [method, subMethod] = await Promise.all([
      SecureStore.getItemAsync(METHOD_KEY),
      SecureStore.getItemAsync(SUB_METHOD_KEY),
    ]);
    return { method, subMethod };
  },
};
