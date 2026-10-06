// Port of lib/screens/customer/edit_profile_screen.dart.
// Backend: update_profile.php, upload_avatar.php, remove_avatar.php.
//  - Phone must be a Philippine mobile number; the server silently stores an
//    empty phone for anything else, so it is validated here first.
//  - Changing the email does NOT change it immediately: the server emails a
//    verification link to the new address (status 'pending_email'). Name, phone
//    and address are saved straight away.
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Field, PrimaryButton } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

/** Stored as 63XXXXXXXXXX; show the familiar 09XXXXXXXXX. */
function toLocalPhone(raw: unknown): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('63') ? `0${d.slice(2)}` : d;
}

/** Same three forms update_profile.php accepts: 639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX. */
function isValidPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  return (d.length === 12 && d.startsWith('639')) || (d.length === 11 && d.startsWith('09')) || (d.length === 10 && d.startsWith('9'));
}

export default function EditProfileScreen() {
  const toast = useToast();
  const { user, session } = useUserSession();
  const [name, setName] = useState(String(user?.full_name ?? user?.name ?? ''));
  const [email, setEmail] = useState(String(user?.email ?? ''));
  const [phone, setPhone] = useState(toLocalPhone(user?.phone));
  const [address, setAddress] = useState(String(user?.address ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const avatar = session.avatarUrl;
  const emailChanged = email.trim().toLowerCase() !== String(user?.email ?? '').toLowerCase();

  async function syncProfile() {
    const res = await api.getProfile();
    if (res.user) userSession.setUser(res.user);
  }

  async function changePhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPhotoBusy(true);
    try {
      await api.uploadAvatar({ uri: a.uri, name: a.fileName ?? 'avatar.jpg', type: a.mimeType ?? 'image/jpeg' });
      await syncProfile();
      toast('Profile photo updated.', 'success');
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not upload the photo.', 'error');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await api.removeAvatar();
      await syncProfile();
      toast('Profile photo removed.', 'success');
    } catch (e) {
      toast(e instanceof ApiException ? e.message : 'Could not remove the photo.', 'error');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (!isValidPhone(phone)) return setError('Enter a valid Philippine mobile number, e.g. 09171234567.');

    setSaving(true);
    try {
      const res = await api.updateProfile({ fullName: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim() });
      await syncProfile().catch(() => {});
      toast(res.message ?? 'Profile updated.', 'success', res.status === 'pending_email' ? 6000 : 2500);
      router.back();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Could not update your profile. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.white }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 96, height: 96 }} contentFit="cover" />
          ) : (
            <Text style={[text.headingMedium, { color: colors.primary }]}>{(name || '?').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
          <Pressable onPress={changePhoto} disabled={photoBusy} hitSlop={8}>
            <Text style={[text.linkText, photoBusy && { opacity: 0.5 }]}>{avatar ? 'Change Photo' : 'Add Photo'}</Text>
          </Pressable>
          {avatar ? (
            <Pressable onPress={removePhoto} disabled={photoBusy} hitSlop={8}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.red, opacity: photoBusy ? 0.5 : 1 }}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ErrorBanner message={error} />
      <Field label="Full Name" value={name} onChangeText={setName} placeholder="Your full name" autoCapitalize="words" />
      <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      {emailChanged && (
        <Text style={[text.bodySmall, { marginTop: -12, marginBottom: 20 }]}>We&apos;ll send a verification link to the new address. Your email changes once you confirm it.</Text>
      )}
      <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="09171234567" keyboardType="phone-pad" />
      <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, barangay, city" multiline />
      <PrimaryButton title="Save Changes" onPress={save} loading={saving} />
    </ScrollView>
  );
}
