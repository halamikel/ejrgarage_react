// Inline form for a delivery profile: recipient + contact + the five address
// fields (Address Line 1/2, City/Town, Province, ZIP Code). Rendered inside the
// cart's ScrollView (not a modal) so the Province dropdown never has to open on
// top of another modal.
import { Select } from '@/components/Select';
import { Field, PrimaryButton } from '@/components/ui';
import { PROVINCES, validateAddress, type AddressErrors, type ShippingAddress } from '@/lib/address';
import type { ProfileInput } from '@/services/addressBook';
import { colors, fonts, text } from '@/theme/theme';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

type Errors = AddressErrors & { label?: string; name?: string; contact?: string };

export function AddressForm({
  title,
  initial,
  showLabel,
  submitText,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial?: Partial<ProfileInput>;
  /** false for "My Profile", whose label is fixed */
  showLabel: boolean;
  submitText: string;
  onSubmit: (value: ProfileInput) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [contact, setContact] = useState(initial?.contact ?? '');
  const [addr, setAddr] = useState<ShippingAddress>({
    line1: initial?.address?.line1 ?? '',
    line2: initial?.address?.line2 ?? '',
    city: initial?.address?.city ?? '',
    province: initial?.address?.province ?? '',
    zip: initial?.address?.zip ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});

  const set = (k: keyof ShippingAddress) => (v: string) => setAddr((a) => ({ ...a, [k]: v }));

  function submit() {
    const e: Errors = validateAddress(addr);
    if (showLabel && label.trim().length < 2) e.label = 'Give this profile a name, e.g. Home or Office';
    if (name.trim().length < 2) e.name = 'Enter the recipient’s name';
    if (contact.trim().length < 7) e.contact = 'Enter a valid contact number';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit({
      label: showLabel ? label.trim() : 'My Profile',
      name: name.trim(),
      contact: contact.trim(),
      address: {
        line1: addr.line1.trim(),
        line2: addr.line2.trim(),
        city: addr.city.trim(),
        province: addr.province.trim(),
        zip: addr.zip.trim(),
      },
    });
  }

  return (
    <View style={{ padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, marginBottom: 12 }}>
      <Text style={[text.headingSmall, { fontSize: 16, marginBottom: 16 }]}>{title}</Text>

      {showLabel && (
        <Field label="Profile Name" value={label} onChangeText={setLabel} placeholder="e.g. Home, Office, Mom's house" error={errors.label} maxLength={30} />
      )}
      <Field label="Recipient Name" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" error={errors.name} />
      <Field label="Contact Number" value={contact} onChangeText={setContact} placeholder="09171234567" keyboardType="phone-pad" error={errors.contact} />

      <Field
        label="Address Line 1"
        value={addr.line1}
        onChangeText={set('line1')}
        placeholder="House/Unit No., Street"
        autoCapitalize="words"
        error={errors.line1}
        testID="cart_address_line1"
      />
      <Field
        label="Address Line 2 (optional)"
        value={addr.line2}
        onChangeText={set('line2')}
        placeholder="Barangay, Subdivision, Landmark"
        autoCapitalize="words"
        error={errors.line2}
      />
      <Field label="City / Town" value={addr.city} onChangeText={set('city')} placeholder="e.g. Marilao" autoCapitalize="words" error={errors.city} />
      <Select label="Province" value={addr.province || null} options={[...PROVINCES]} onChange={set('province')} placeholder="Select province" />
      {errors.province ? <Text style={[text.error, { marginTop: -14, marginBottom: 16 }]}>{errors.province}</Text> : null}
      <Field
        label="ZIP Code"
        value={addr.zip}
        onChangeText={(v) => set('zip')(v.replace(/\D/g, '').slice(0, 4))}
        placeholder="4-digit ZIP"
        keyboardType="number-pad"
        maxLength={4}
        error={errors.zip}
      />

      <PrimaryButton title={submitText} onPress={submit} />
      <Pressable onPress={onCancel} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.greyText }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
