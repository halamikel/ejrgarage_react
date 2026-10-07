// Port of lib/screens/customer/profile_screen.dart: account header + menu.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { logout } from '@/lib/auth';
import { api } from '@/services/api';
import { useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MENU: { icon: IconName; label: string; href: string }[] = [
  { icon: 'star-outline', label: 'My EJR Points', href: '/(customer)/rewards' },
  { icon: 'bag-outline', label: 'My Orders', href: '/my-orders' },
  { icon: 'calendar-outline', label: 'Appointments', href: '/appointments' },
  { icon: 'car-outline', label: 'My Vehicles', href: '/my-vehicles' },
  { icon: 'chatbox-ellipses-outline', label: 'My Inquiries', href: '/my-inquiries' },
  { icon: 'person-outline', label: 'Edit Profile', href: '/edit-profile' },
  { icon: 'settings-outline', label: 'Settings', href: '/settings' },
  { icon: 'document-text-outline', label: 'Terms & Conditions', href: '/terms' },
];

export default function CustomerProfile() {
  const { user, session } = useUserSession();

  // Refresh from get_profile.php whenever the tab is shown, so edits made on
  // the Edit Profile screen appear right away.
  useFocusEffect(
    useCallback(() => {
      api
        .getProfile()
        .then((res) => res.user && userSession.setUser(res.user))
        .catch((e) => console.log('[Profile] get_profile.php failed:', e));
    }, []),
  );

  const avatar = session.avatarUrl;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 96, height: 96 }} contentFit="cover" />
            ) : (
              <Text style={[text.headingMedium, { color: colors.primary }]}>{(user?.full_name ?? user?.name ?? '?').toString().charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={[text.headingSmall, { marginTop: 14 }]}>{session.displayName}</Text>
          <Text style={[text.bodyMedium, { marginTop: 2 }]}>{session.email}</Text>
        </View>

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.greyBorder, overflow: 'hidden', marginBottom: 28 }}>
          {MENU.map((m, i) => (
            <Pressable
              key={m.href}
              onPress={() => router.push(m.href)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 15,
                backgroundColor: pressed ? colors.greyLight : colors.white,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.greyLight,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={m.icon} size={19} color={colors.primary} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.black }}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.grey} />
            </Pressable>
          ))}
        </View>

        <PrimaryButton title="Log Out" onPress={() => logout(router)} />
      </ScrollView>
    </SafeAreaView>
  );
}