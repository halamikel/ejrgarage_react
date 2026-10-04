import { Redirect } from 'expo-router';
import { homeRouteForRole, useUserSession } from '@/services/session';

type Role = 'admin' | 'mechanic' | 'customer';

/**
 * Call at the top of a role group's _layout (after any other hooks).
 * Returns a <Redirect> element when the visitor shouldn't be here, else null.
 * Mirrors Flutter's splash/login role switch: admin -> admin area, mechanic ->
 * mechanic area, everyone else -> customer area.
 */
export function useRoleGuard(role: Role) {
  const { user, session } = useUserSession();
  if (!user) return <Redirect href="/get-started" />;
  const actual: Role = session.isAdmin ? 'admin' : session.isMechanic ? 'mechanic' : 'customer';
  if (actual !== role) return <Redirect href={homeRouteForRole()} />;
  return null;
}
