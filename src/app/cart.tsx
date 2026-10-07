// Port of lib/screens/customer/cart_screen.dart.
import { AddressForm } from '@/components/AddressForm';
import { useToast } from '@/components/Toast';
import { PrimaryButton } from '@/components/ui';
import { formatAddress, isAddressComplete } from '@/lib/address';
import { confirm, showAlert } from '@/lib/dialogs';
import { peso } from '@/lib/format';
import { ACCOUNT_PROFILE_ID, useDeliveryProfiles, type DeliveryProfile, type ProfileInput } from '@/services/addressBook';
import { ApiException, api } from '@/services/api';
import { cart, useCart } from '@/services/cart';
import { paymentPreference } from '@/services/paymentPreference';
import { qrphHandoff } from '@/services/qrphHandoff';
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
  View
} from 'react-native';

type PaymentMethod = 'online' | 'cod';
type OnlineSub = 'card' | 'qrph';

export default function CartScreen() {
  const router = useRouter();
  const toast = useToast();
  const { items, totalPrice, isEmpty } = useCart();

  const { profiles, add, update, remove } = useDeliveryProfiles();
  const [selectedId, setSelectedId] = useState<string>(ACCOUNT_PROFILE_ID);
  // null = form closed, 'new' = adding another profile, otherwise the id being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('online');
  const [sub, setSub] = useState<OnlineSub>('qrph');
  const [placing, setPlacing] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  useEffect(() => {
    cart.load();
    paymentPreference.load().then(({ method: m, subMethod }) => {
      if (m === 'cod' || m === 'online') setMethod(m);
      if (subMethod === 'card' || subMethod === 'qrph') setSub(subMethod);
    });
  }, []);

  function saveProfile(input: ProfileInput) {
    if (editingId === 'new') {
      const created = add(input);
      setSelectedId(created.id);
      toast('Profile added.', 'success');
    } else if (editingId) {
      update(editingId, input);
      setSelectedId(editingId);
      toast('Profile updated.', 'success');
    }
    setProfileError(null);
    setEditingId(null);
  }

  async function deleteProfile(p: DeliveryProfile) {
    if (await confirm('Delete profile?', `Remove "${p.label}" from your saved delivery profiles?`, { confirmText: 'Delete', destructive: true })) {
      remove(p.id);
      if (selectedId === p.id) setSelectedId(ACCOUNT_PROFILE_ID);
      if (editingId === p.id) setEditingId(null);
    }
  }

  async function clearCart() {
    if (await confirm('Clear cart?', 'All items will be removed.', { confirmText: 'Yes, clear it', destructive: true })) {
      cart.clear();
    }
  }

  function validate() {
    if (editingId) {
      setProfileError('Save or cancel the profile you are editing first.');
      return false;
    }
    const ok =
      !!selected &&
      selected.name.trim().length >= 2 &&
      selected.contact.trim().length >= 7 &&
      isAddressComplete(selected.address);
    if (!ok) {
      setProfileError('This profile is missing details. Tap Edit to complete the name, contact number and address.');
      return false;
    }
    setProfileError(null);
    return true;
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
        customerName: selected.name.trim(),
        contact: selected.contact.trim(),
        address: formatAddress(selected.address),
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
    const total = cart.totalPrice;
    try {
      const res = await api.createQrphPayment({
        customerName: selected.name.trim(),
        contact: selected.contact.trim(),
        address: formatAddress(selected.address),
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
          <Text style={text.headingSmall}>Total</Text>
          <Text style={[text.headingSmall, { color: colors.primary }]}>{peso(totalPrice)}</Text>
        </View>

        <Text style={[text.headingSmall, { marginTop: 24, marginBottom: 12 }]}>Place Order</Text>
        <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>DELIVER TO</Text>
        {profiles.map((p) =>
          editingId === p.id ? (
            <AddressForm
              key={p.id}
              title={p.isAccount ? 'Edit My Profile Address' : `Edit ${p.label}`}
              showLabel={!p.isAccount}
              initial={p}
              submitText="Save & Use"
              onSubmit={saveProfile}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ProfileCard
              key={p.id}
              profile={p}
              selected={selected?.id === p.id}
              onSelect={() => {
                setSelectedId(p.id);
                setProfileError(null);
              }}
              onEdit={() => setEditingId(p.id)}
              onDelete={p.isAccount ? undefined : () => deleteProfile(p)}
            />
          ),
        )}
        {editingId === 'new' ? (
          <AddressForm
            title="Add Another Profile & Address"
            showLabel
            submitText="Save & Use"
            onSubmit={saveProfile}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <Pressable onPress={() => setEditingId('new')} style={styles.addBtn} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 }}>Add another profile / shipping address</Text>
          </Pressable>
        )}
        {profileError ? <Text style={[text.error, { marginTop: 8 }]}>{profileError}</Text> : null}

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

function ProfileCard({
  profile,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  profile: DeliveryProfile;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const complete =
    profile.name.trim().length >= 2 && profile.contact.trim().length >= 7 && isAddressComplete(profile.address);
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.method, { alignItems: 'flex-start' }, selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.grey} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{profile.label}</Text>
        {profile.name || profile.contact ? (
          <Text style={[text.bodyMedium, { fontSize: 13 }]}>{[profile.name, profile.contact].filter(Boolean).join(' · ')}</Text>
        ) : null}
        {complete ? (
          <Text style={[text.bodySmall, { color: colors.greyText, marginTop: 2 }]}>{formatAddress(profile.address)}</Text>
        ) : (
          <Text style={[text.error, { marginTop: 2 }]}>Incomplete details — tap Edit to finish this profile.</Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 10 }}>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel={`Edit ${profile.label}`}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Delete ${profile.label}`}>
            <Ionicons name="trash-outline" size={20} color={colors.red} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  method: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.greyBorder, marginBottom: 8 },
  subChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.greyBorder },
});
