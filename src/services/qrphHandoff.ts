// The QR Ph code arrives as a (large) base64 image. Passing that through route
// params would put it in the URL, so hand it to the payment screen in memory.
export type PendingQr = { orderId: number; qrImage: string; totalPrice: number; expiresIn: number };

let pending: PendingQr | null = null;

export const qrphHandoff = {
  set(p: PendingQr) {
    pending = p;
  },
  get(orderId: number): PendingQr | null {
    return pending && pending.orderId === orderId ? pending : null;
  },
};
