// Port of lib/services/payment_preference_service.dart.
import { secureStorage } from './secureStorage';

const METHOD_KEY = 'last_payment_method'; // 'online' | 'cod'
const SUB_METHOD_KEY = 'last_payment_submethod'; // 'card' | 'qrph'

export const paymentPreference = {
  async save(args: { method: string; subMethod?: string }) {
    await secureStorage.setItem(METHOD_KEY, args.method);
    if (args.subMethod != null) await secureStorage.setItem(SUB_METHOD_KEY, args.subMethod);
  },
  async load(): Promise<{ method: string | null; subMethod: string | null }> {
    const [method, subMethod] = await Promise.all([
      secureStorage.getItem(METHOD_KEY),
      secureStorage.getItem(SUB_METHOD_KEY),
    ]);
    return { method, subMethod };
  },
};
