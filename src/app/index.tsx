// Port of lib/screens/splash_screen.dart.
//
// Animated logo while we: check for a stored token, run the root/jailbreak
// check, check the minimum app version, and re-load the profile. Then route by
// role. (Native splash -> this animated splash -> destination.)

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/services/api';
import { checkForUpdate } from '@/services/appUpdate';
import { isDeviceCompromised } from '@/services/deviceIntegrity';
import { homeRouteForRole, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

type Blocker = { kind: 'update'; message: string } | { kind: 'security' } | null;

export default function SplashScreen() {
  const router = useRouter();
  const [blocker, setBlocker] = useState<Blocker>(null);
  const continueAnyway = useRef<(() => void) | null>(null);

  // Logo: scale 0.7 -> 1 (easeOutBack, 700ms), fade in over the first 60%,
  // then a gentle 1 <-> 1.05 pulse.
  const scale = useRef(new Animated.Value(0.7)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, fade, pulse]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [loggedIn, , compromised, update] = await Promise.all([
        api.isLoggedIn(),
        new Promise((r) => setTimeout(r, 1800)),
        isDeviceCompromised(),
        checkForUpdate(),
      ]);

      if (loggedIn) {
        try {
          const profile = await api.getProfile();
          if (profile.user) userSession.setUser(profile.user);
        } catch (e) {
          console.log('[Splash] Profile fetch failed:', e);
        }
      }
      if (cancelled) return;

      if (update.updateRequired) {
        // Non-dismissable: the user has to update from the store.
        setBlocker({
          kind: 'update',
          message:
            update.updateMessage ??
            `A new version of EJR Mobile is available. Please update to continue (current: ${update.currentVersion}, required: ${update.minRequiredVersion}).`,
        });
        return;
      }

      if (compromised) {
        await new Promise<void>((resolve) => {
          continueAnyway.current = resolve;
          setBlocker({ kind: 'security' });
        });
        setBlocker(null);
      }
      if (cancelled) return;

      if (loggedIn && userSession.user) router.replace(homeRouteForRole());
      else router.replace('/get-started');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <LinearGradient colors={[colors.splashBgLight, colors.splashBg]} style={styles.fill}>
      <Animated.Image
        source={require('../../assets/images/ejr_logo_splash.png')}
        resizeMode="contain"
        style={{ width: 180, height: 180, opacity: fade, transform: [{ scale: Animated.multiply(scale, pulse) }] }}
      />

      <Modal visible={blocker != null} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={[text.headingSmall, { marginBottom: 12 }]}>
              {blocker?.kind === 'update' ? 'Update Required' : 'Security Warning'}
            </Text>
            <Text style={[text.bodyMedium, { lineHeight: 21 }]}>
              {blocker?.kind === 'update'
                ? blocker.message
                : 'This device appears to be rooted or jailbroken. Running EJR Mobile on a modified device may expose your account and payment information to additional risk. Proceed with caution.'}
            </Text>
            {blocker?.kind === 'security' && (
              <Pressable style={styles.dialogBtn} onPress={() => continueAnyway.current?.()}>
                <Text style={{ fontFamily: fonts.semibold, color: colors.primary }}>Continue Anyway</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  dialogBtn: { alignSelf: 'flex-end', marginTop: 20, paddingVertical: 8, paddingHorizontal: 8 },
});
