// Minimal working profile card (avatar, name, email, role, logout) so every
// role area has a functional account screen until the full Flutter screens
// (profile_screen / edit_profile / settings / admin_account) are ported.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { logout } from '@/lib/auth';
import { api } from '@/services/api';
import { useUserSession, userSession } from '@/services/session';
import { colors, text } from '@/theme/theme';

export function ProfileSummary() {
  const router = useRouter();
  const { user, session } = useUserSession();

  // Same as Flutter's ProfileScreen._loadProfile: refresh from get_profile.php.
  useEffect(() => {
    api
      .getProfile()
      .then((res) => res.user && userSession.setUser(res.user))
      .catch((e) => console.log('[Profile] get_profile.php failed:', e));
  }, []);

  const role = session.isAdmin ? 'Admin' : session.isMechanic ? 'Mechanic' : 'Customer';
  const avatar = session.avatarUrl;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white, padding: 24 }}>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.primaryLight,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 96, height: 96 }} contentFit="cover" />
          ) : (
            <Text style={[text.headingMedium, { color: colors.primary }]}>
              {(user?.full_name ?? user?.name ?? '?').toString().charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={[text.headingSmall, { marginTop: 16 }]}>{session.displayName}</Text>
        <Text style={[text.bodyMedium, { marginTop: 4 }]}>{session.email}</Text>
        <Text style={[text.linkText, { marginTop: 8 }]}>{role}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <PrimaryButton title="Log Out" onPress={() => logout(router)} />
    </SafeAreaView>
  );
}
