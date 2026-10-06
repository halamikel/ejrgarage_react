// Port of lib/screens/customer/settings_screen.dart.
// Backend: save_notifications.php (email + SMS saved together) and change_password.php.
// A preference counts as ON only when it is exactly 1, same as the website's settings page.
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Field, PrimaryButton } from '@/components/ui';
import { ApiException, api } from '@/services/api';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

export default function SettingsScreen() {
  const toast = useToast();
  const { user } = useUserSession();
  const notifEmail = Number(user?.notif_email) === 1;
  const notifSms = Number(user?.notif_sms) === 1;
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  async function setPref(p: { email?: boolean; sms?: boolean }) {
    if (!user || savingPrefs) return;
    const email = p.email ?? notifEmail;
    const sms = p.sms ?? notifSms;
    const before = user;
    // Optimistic: flip the switch now, put it back if the server says no.
    userSession.setUser({ ...user, notif_email: email ? 1 : 0, notif_sms: sms ? 1 : 0 });
    setSavingPrefs(true);
    try {
      await api.saveNotificationPreferences({ notifEmail: email, notifSms: sms });
    } catch (e) {
      userSession.setUser(before);
      toast(e instanceof ApiException ? e.message : 'Could not save your preference.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function changePassword() {
    setPwError(null);
    if (!current || !next || !confirm) return setPwError('Please fill in all password fields.');
    if (next.length < 8) return setPwError('New password must be at least 8 characters.');
    if (next !== confirm) return setPwError('New passwords do not match.');
    if (next === current) return setPwError('Choose a password different from your current one.');

    setChanging(true);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next, confirmPassword: confirm });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password updated successfully.', 'success');
    } catch (e) {
      setPwError(e instanceof ApiException ? e.message : 'Could not change your password. Check your connection.');
    } finally {
      setChanging(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.white }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={[text.headingSmall, { marginBottom: 4 }]}>Notifications</Text>
      <Text style={[text.bodyMedium, { marginBottom: 16 }]}>Choose how we update you about appointments and orders.</Text>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.greyBorder, marginBottom: 32 }}>
        <PrefRow label="Email notifications" hint="Status updates and receipts" value={notifEmail} disabled={savingPrefs} onChange={(v) => setPref({ email: v })} />
        <View style={{ height: 1, backgroundColor: colors.greyLight }} />
        <PrefRow label="SMS notifications" hint="Text messages to your phone" value={notifSms} disabled={savingPrefs} onChange={(v) => setPref({ sms: v })} />
      </View>

      <Text style={[text.headingSmall, { marginBottom: 16 }]}>Change Password</Text>
      <ErrorBanner message={pwError} />
      <Field label="Current Password" value={current} onChangeText={setCurrent} placeholder="Enter current password" password autoCapitalize="none" />
      <Field label="New Password" value={next} onChangeText={setNext} placeholder="At least 8 characters" password autoCapitalize="none" />
      <Field label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Re-enter new password" password autoCapitalize="none" />
      <PrimaryButton title="Update Password" onPress={changePassword} loading={changing} />
    </ScrollView>
  );
}

function PrefRow({ label, hint, value, disabled, onChange }: { label: string; hint: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.black }}>{label}</Text>
        <Text style={text.bodySmall}>{hint}</Text>
      </View>
      <Switch value={value} disabled={disabled} trackColor={{ true: colors.primary, false: colors.greyBorder }} onValueChange={onChange} />
    </View>
  );
}
