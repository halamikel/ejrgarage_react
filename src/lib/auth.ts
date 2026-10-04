import type { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { stopPolling } from '@/services/notifications';
import { userSession } from '@/services/session';

/** Clears the token + in-memory session and returns to the welcome screen. */
type AppRouter = ReturnType<typeof useRouter>;

export async function logout(router: AppRouter) {
  stopPolling();
  await api.logout();
  userSession.clear();
  router.replace('/get-started');
}
