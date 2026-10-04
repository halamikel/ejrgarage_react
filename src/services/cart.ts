// Port of lib/services/cart_service.dart (ChangeNotifier -> external store).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  stock: number;
};

const STORAGE_KEY = 'ejr_cart';

function fromJson(json: Record<string, any>): CartItem {
  const price = parseFloat(String(json.price));
  const qty = parseInt(String(json.qty), 10);
  const stock = parseInt(String(json.stock), 10);
  return {
    id: String(json.id),
    name: typeof json.name === 'string' ? json.name : '',
    price: Number.isNaN(price) ? 0 : price,
    qty: Number.isNaN(qty) ? 1 : qty,
    stock: Number.isNaN(stock) ? 999999 : stock,
  };
}

class CartService {
  // Immutable snapshot: replaced (never mutated) so useSyncExternalStore
  // sees a new reference on every change.
  private _items: readonly CartItem[] = [];
  private listeners = new Set<() => void>();
  private loaded = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => this._items;

  get items() {
    return this._items;
  }
  get totalQty() {
    return this._items.reduce((sum, i) => sum + i.qty, 0);
  }
  get totalPrice() {
    return this._items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }
  get isEmpty() {
    return this._items.length === 0;
  }

  private commit(items: CartItem[]) {
    this._items = items;
    this.listeners.forEach((l) => l());
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._items = (JSON.parse(raw) as Record<string, any>[]).map(fromJson);
        this.listeners.forEach((l) => l());
      }
    } catch {
      // corrupt/unavailable storage -> start with an empty cart
    }
  }

  /** Returns false if the item is out of stock / already at max. */
  add(id: string, name: string, price: number, stock: number): boolean {
    const existing = this._items.find((e) => e.id === id);
    if (existing) {
      if (existing.qty >= stock) {
        this.commit(this._items.map((e) => (e.id === id ? { ...e, stock } : e)));
        return false;
      }
      this.commit(this._items.map((e) => (e.id === id ? { ...e, stock, qty: e.qty + 1 } : e)));
      return true;
    }
    if (stock <= 0) return false;
    this.commit([...this._items, { id, name, price, qty: 1, stock }]);
    return true;
  }

  /** Returns false if the requested increase was capped by stock. */
  changeQty(id: string, delta: number): boolean {
    const item = this._items.find((e) => e.id === id);
    if (!item) return false;
    let applied = true;
    let newQty = item.qty + delta;
    if (delta > 0 && newQty > item.stock) {
      newQty = item.stock;
      applied = false;
    }
    this.commit(
      newQty <= 0
        ? this._items.filter((e) => e.id !== id)
        : this._items.map((e) => (e.id === id ? { ...e, qty: newQty } : e)),
    );
    return applied;
  }

  remove(id: string) {
    this.commit(this._items.filter((e) => e.id !== id));
  }
  clear() {
    this.commit([]);
  }

  /** Shape place_order.php expects: id, name, price, qty (+stock). */
  toOrderItems() {
    return this._items.map((e) => ({ ...e }));
  }
}

export const cart = new CartService();

export function useCart() {
  const items = useSyncExternalStore(cart.subscribe, cart.getSnapshot);
  return { items, totalQty: cart.totalQty, totalPrice: cart.totalPrice, isEmpty: items.length === 0, cart };
}
