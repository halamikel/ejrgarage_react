// Port of lib/screens/customer/cart_screen.dart.
import { useToast } from '@/components/Toast';
import { PrimaryButton } from '@/components/ui';
import { confirm, showAlert } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { ApiException, api } from '@/services/api';
import { cart, useCart } from '@/services/cart';
import { paymentPreference } from '@/services/paymentPreference';
import { qrphHandoff } from '@/services/qrphHandoff';
import { userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

type PaymentMethod = 'online' | 'cod';
type OnlineSub = 'card' | 'qrph';

export default function CartScreen() {
  const router = useRouter();
  const toast = useToast();
  const { items, totalPrice, isEmpty } = useCart();

  const user = userSession.user;
  const savedAddress = String(user?.address ?? '').trim();
  const [name, setName] = useState(String(user?.full_name ?? user?.name ?? ''));
  const [contact, setContact] = useState(String(user?.phone ?? ''));
  const [address, setAddress] = useState(savedAddress);
  const [errors, setErrors] = useState<{ name?: string; contact?: string; address?: string }>({});
  const [method, setMethod] = useState<PaymentMethod>('online');
  const [sub, setSub] = useState<OnlineSub>('qrph');
  const [placing, setPlacing] = useState(false);

  const [voucherCode, setVoucherCode] = useState('');
const [voucherApplied, setVoucherApplied] = useState(false);
const [voucherDiscount, setVoucherDiscount] = useState(0);
const [voucherTotal, setVoucherTotal] = useState<number | null>(null);
const [voucherLoading, setVoucherLoading] = useState(false);
const [voucherError, setVoucherError] = useState('');

const discountedTotal =
  voucherApplied && voucherTotal !== null
    ? voucherTotal
    : totalPrice;

  const scroller = useRef<ScrollView>(null);

  const addressMatchesSaved = savedAddress.length > 0 && address.trim() === savedAddress;

  useEffect(() => {
    cart.load();
    paymentPreference.load().then(({ method: m, subMethod }) => {
      if (m === 'cod' || m === 'online') setMethod(m);
      if (subMethod === 'card' || subMethod === 'qrph') setSub(subMethod);
    });
  }, []);

useEffect(() => {
  setVoucherApplied(false);
  setVoucherDiscount(0);
  setVoucherTotal(null);
  setVoucherError('');
}, [totalPrice]);

  function applyProfileAddress() {
    if (!savedAddress) {
      showAlert('No Saved Address', 'You do not have an address saved in your profile yet.');
      return;
    }
    setAddress(savedAddress);
  }

  async function clearCart() {
    if (await confirm('Clear cart?', 'All items will be removed.', { confirmText: 'Yes, clear it', destructive: true })) {
      cart.clear();
    }
  }

  function validate() {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'Enter your name';
    if (contact.trim().length < 7) e.contact = 'Enter a valid contact number';
    if (!address.trim()) e.address = 'Enter your address';
    setErrors(e);
    return !e.name && !e.contact && !e.address;
  }

  async function applyVoucher() {

  const code = voucherCode.trim().toUpperCase();

  if (!code) {
    setVoucherError('Enter a voucher code.');
    return;
  }

  setVoucherLoading(true);
  setVoucherError('');

  try {

const res = await api.post('validate_voucher.php', {
  code,
  subtotal: totalPrice,
});

    if (res.status !== 'success') {
      throw new ApiException(
        res.message ?? 'This voucher cannot be used.'
      );
    }

    const discount = Number(
      res.discount ?? 0
    );

    const total = Number(
      res.total ?? totalPrice - discount
    );

    setVoucherCode(
      String(res.voucher?.code ?? code)
    );

    setVoucherDiscount(discount);

    setVoucherTotal(total);

    setVoucherApplied(true);

    toast('Voucher applied.');

  } catch (error) {
  console.log('VOUCHER ERROR:', error);

  setVoucherApplied(false);
  setVoucherDiscount(0);
  setVoucherTotal(null);

  setVoucherError(
    error instanceof ApiException
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error)
  );
} finally {

    setVoucherLoading(false);
  }
}

function removeVoucher() {

  setVoucherCode('');
  setVoucherApplied(false);
  setVoucherDiscount(0);
  setVoucherTotal(null);
  setVoucherError('');
}

  async function placeOrder() {
    if (!validate()) return;

    await paymentPreference.save({ method, subMethod: method === 'online' ? sub : undefined });
    if (!(await api.isLoggedIn())) {
      toast('Please log in to place an order.');
      return;
    }
    if (method === 'online' && sub === 'qrph') return placeQrphOrder();

    setPlacing(true);
    try {
      const res = await api.placeOrder({
        customerName: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        items: cart.toOrderItems(),
        totalPrice: cart.totalPrice,
        paymentMethod: method,
      });
      if (res.status !== 'success') throw new ApiException(res.message ?? 'Order failed.');
      cart.clear();

      const checkoutUrl: string | undefined = res.checkout_url;
      if (checkoutUrl) {
        await openCheckout(checkoutUrl);
      } else {
        await showAlert(
          'Order Placed!',
          method === 'cod'
            ? 'Your order is pending. Please prepare exact cash for delivery/pickup.'
            : (res.message ?? 'Your order is now pending. We will contact you shortly.'),
        );
      }
      router.replace('/my-orders');
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Failed to connect to server.');
    } finally {
      setPlacing(false);
    }
  }

  async function placeQrphOrder() {
    setPlacing(true);
    const total = discountedTotal;
    try {
      const res = await api.createQrphPayment({
        customerName: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        items: cart.toOrderItems(),
        totalPrice: total,
      });
      if (res.status !== 'success' || res.qr_image == null || res.order_id == null) {
        throw new ApiException(res.message ?? 'Could not generate QR code.');
      }
      cart.clear();
      const orderId = Number(res.order_id);
      qrphHandoff.set({ orderId, qrImage: String(res.qr_image), totalPrice: total, expiresIn: Number(res.expires_in ?? 1800) });
      router.push({ pathname: '/qrph-payment', params: { orderId: String(orderId) } });
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Failed to connect to server.');
    } finally {
      setPlacing(false);
    }
  }

  async function openCheckout(url: string) {
    let launched = false;
    try {
      await Linking.openURL(url);
      launched = true;
    } catch {
      launched = false;
    }
    if (launched) {
      await showAlert(
        'Complete Your Payment',
        "Finish paying in the browser tab that just opened. Once you're done, come back here — your order status will update once payment is confirmed.",
      );
    } else {
      const copy = await confirm(
        'Order Placed!',
        `We couldn't open a browser automatically. Copy this payment link and open it to complete payment:\n\n${url}`,
        { confirmText: 'Copy Link', cancelText: 'OK' },
      );
      if (copy) {
        await Clipboard.setStringAsync(url);
        toast('Link copied.');
      }
    }
  }

  if (isEmpty) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ headerRight: () => <OrdersButton /> }} />
        <Ionicons name="cart-outline" size={56} color={colors.grey} />
        <Text style={[text.headingSmall, { marginTop: 16 }]}>Your cart is empty</Text>
        <Text style={[text.bodyMedium, { marginTop: 8, marginBottom: 24 }]}>Browse parts and add items to get started.</Text>
        <PrimaryButton title="Browse Parts" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <OrdersButton />
              <Pressable onPress={clearCart}>
                <Text style={{ color: colors.red, fontFamily: fonts.medium }}>Clear</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {items.map((item) => {
          const atMax = item.qty >= item.stock;
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{item.name}</Text>
                <Text style={text.bodySmall}>{peso(item.price)} each</Text>
                {atMax && <Text style={{ color: colors.red, fontSize: 11, fontFamily: fonts.medium, marginTop: 2 }}>Max stock reached</Text>}
              </View>
              <View style={styles.qtyRow}>
                <QtyButton icon="remove" onPress={() => cart.changeQty(item.id, -1)} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, minWidth: 28, textAlign: 'center' }}>{item.qty}</Text>
                <QtyButton
                  icon="add"
                  disabled={atMax}
                  onPress={() => {
                    if (!cart.changeQty(item.id, 1)) toast(`Only ${item.stock} in stock for ${item.name}`, 'error');
                  }}
                />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary, width: 82, textAlign: 'right' }}>
                {peso(item.price * item.qty)}
              </Text>
              <Pressable onPress={() => cart.remove(item.id)} hitSlop={8} accessibilityLabel={`Remove ${item.name}`} style={{ marginLeft: 6 }}>
                <Ionicons name="trash-outline" size={20} color={colors.red} />
              </Pressable>
            </View>
          );
        })}

<View style={styles.totalRow}>
  <Text style={text.headingSmall}>Subtotal</Text>
  <Text style={[text.headingSmall, { color: colors.primary }]}>
    {peso(totalPrice)}
  </Text>
</View>

<View style={{ marginTop: 18 }}>
  <Text style={styles.sectionLabel}>VOUCHER</Text>

  <View
    style={{
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    }}
  >
    <TextInput
      placeholder="Enter voucher code"
      placeholderTextColor={colors.grey}
      value={voucherCode}
      onChangeText={(value) => {
        setVoucherCode(value.toUpperCase());
        setVoucherError('');
      }}
      autoCapitalize="characters"
      editable={!voucherLoading && !placing}
      style={[
        styles.input,
        {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.greyBorder,
        },
      ]}
    />

    <Pressable
      onPress={voucherApplied ? removeVoucher : applyVoucher}
      disabled={voucherLoading || placing}
      style={{
        minWidth: 90,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        backgroundColor: voucherApplied
          ? colors.red
          : colors.primary,
        opacity: voucherLoading || placing ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          color: colors.white,
          fontFamily: fonts.semibold,
          fontSize: 13,
        }}
      >
        {voucherLoading
          ? 'Checking...'
          : voucherApplied
            ? 'Remove'
            : 'Apply'}
      </Text>
    </Pressable>
  </View>

  {voucherError ? (
    <Text style={[text.error, { marginTop: 6 }]}>
      {voucherError}
    </Text>
  ) : null}

  {voucherApplied ? (
    <>
      <View style={[styles.totalRow, { marginTop: 12 }]}>
        <Text style={text.bodyMedium}>
          Voucher Discount
        </Text>

        <Text style={[text.bodyMedium, { color: colors.green }]}>
          -{peso(voucherDiscount)}
        </Text>
      </View>

      <View style={[styles.totalRow, { marginTop: 8 }]}>
        <Text style={text.headingSmall}>Total</Text>

        <Text style={[text.headingSmall, { color: colors.primary }]}>
          {peso(discountedTotal)}
        </Text>
      </View>
    </>
  ) : null}
</View>

        <Text style={[text.headingSmall, { marginTop: 24, marginBottom: 12 }]}>Place Order</Text>
        <CartField placeholder="Your Name" value={name} onChangeText={setName} error={errors.name} />
        <CartField placeholder="Contact Number" value={contact} onChangeText={setContact} keyboardType="phone-pad" error={errors.contact} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>DELIVERY / PICKUP ADDRESS</Text>
          <Pressable onPress={applyProfileAddress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 }}>Use Profile Address</Text>
          </Pressable>
        </View>
        <CartField
          placeholder="Enter your complete address"
          value={address}
          onChangeText={setAddress}
          error={errors.address}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
          testID="cart_address_field"
        />
        {addressMatchesSaved ? (
          <View style={styles.noteRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.green} />
            <Text style={[text.bodySmall, { color: colors.green }]}>Your saved profile address has been loaded.</Text>
          </View>
        ) : (
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.grey} />
            <Text style={[text.bodySmall, { flex: 1 }]}>You can use your saved profile address or enter a different address for this order.</Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 8 }]}>PAYMENT METHOD</Text>
        <MethodCard
          icon="card-outline"
          title="Pay Online"
          subtitle="Card or QR Ph via secure checkout"
          selected={method === 'online'}
          onPress={() => setMethod('online')}
        />
        {method === 'online' && (
          <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8, paddingLeft: 12 }}>
            <SubChip icon="qr-code-outline" label="QR Ph" selected={sub === 'qrph'} onPress={() => setSub('qrph')} />
            <SubChip icon="card-outline" label="Card" selected={sub === 'card'} onPress={() => setSub('card')} />
          </View>
        )}
        <MethodCard
          icon="cash-outline"
          title="Cash on Delivery"
          subtitle="Pay in cash upon pickup/delivery"
          selected={method === 'cod'}
          onPress={() => setMethod('cod')}
        />

        <PrimaryButton title="Place Order" onPress={placeOrder} loading={placing} style={{ marginTop: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OrdersButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/my-orders')} hitSlop={10} accessibilityLabel="My Orders">
      <Ionicons name="receipt-outline" size={24} color={colors.black} />
    </Pressable>
  );
}

function QtyButton({ icon, onPress, disabled }: { icon: 'add' | 'remove'; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.qtyBtn, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={16} color={colors.black} />
    </Pressable>
  );
}

function CartField({ error, style, ...rest }: React.ComponentProps<typeof TextInput> & { error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        {...rest}
        placeholderTextColor={colors.grey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { borderColor: focused ? colors.primary : colors.greyBorder, borderWidth: focused ? 1.5 : 1 },
          style,
        ]}
      />
      {error ? <Text style={[text.error, { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

function MethodCard(p: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={p.onPress}
      style={[styles.method, p.selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
    >
      <Ionicons name={p.icon} size={24} color={p.selected ? colors.primary : colors.greyText} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{p.title}</Text>
        <Text style={text.bodySmall}>{p.subtitle}</Text>
      </View>
      <Ionicons name={p.selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={p.selected ? colors.primary : colors.grey} />
    </Pressable>
  );
}

function SubChip(p: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={p.onPress}
      style={[styles.subChip, p.selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
    >
      <Ionicons name={p.icon} size={18} color={p.selected ? colors.primary : colors.greyText} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: p.selected ? colors.primary : colors.black }}>{p.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.white },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    gap: 8,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: colors.greyBorder, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.greyBorder },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, color: colors.greyText },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontFamily: fonts.regular, color: colors.black },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  method: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.greyBorder, marginBottom: 8 },
  subChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.greyBorder },
});
