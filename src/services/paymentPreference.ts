// Port of lib/services/payment_preference_service.dart.
import { secureStorage } from './secureStorage';

const METHOD_KEY = 'last_payment_method'; // 'online' | 'cod'
const SUB_METHOD_KEY = 'last_payment_submethod'; // 'card' | 'qrph'

export const paymentPreference = {
  async save(args: { method: string; subMethod?: string }) {
    await secureStorage.setItem(METHOD_KEY, args.method);
    // Always sync the sub-method: switching to COD must not leave a stale 'qrph'/'card' behind.
    if (args.subMethod != null) await secureStorage.setItem(SUB_METHOD_KEY, args.subMethod);
    else await secureStorage.deleteItem(SUB_METHOD_KEY);
  },
  async load(): Promise<{ method: string | null; subMethod: string | null }> {
    const [method, subMethod] = await Promise.all([
      secureStorage.getItem(METHOD_KEY),
      secureStorage.getItem(SUB_METHOD_KEY),
    ]);
    return { method, subMethod };
  },
};
