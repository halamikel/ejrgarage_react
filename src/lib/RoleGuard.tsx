import { Redirect } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { homeRouteForRole, useUserSession } from '@/services/session';
import { colors } from '@/theme/theme';

type Role = 'admin' | 'mechanic' | 'customer';

/**
 * Call at the top of a role group's _layout (after any other hooks).
 * Returns an element to render when the visitor shouldn't see the screen yet
 * (still restoring their login) or at all (logged out / wrong role), else null.
 * Mirrors Flutter's splash/login role switch: admin -> admin area, mechanic ->
 * mechanic area, everyone else -> customer area.
 */
export function useRoleGuard(role: Role) {
  const { user, session } = useUserSession();
  const restoring = useSyncExternalStore(session.subscribe, () => session.restoring);

  if (!user) {
    // On web a refresh lands straight inside a role area with an empty in-memory
    // session. Wait for the stored login to be restored before deciding.
    if (restoring) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <Redirect href="/get-started" />;
  }
  const actual: Role = session.isAdmin ? 'admin' : session.isMechanic ? 'mechanic' : 'customer';
  if (actual !== role) return <Redirect href={homeRouteForRole()} />;
  return null;
}