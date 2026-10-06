// Port of lib/services/notification_service.dart.
//
// Mechanics get a local notification when a new job shows up. As in the
// Flutter version this is a 30s foreground poll of get_mechanic_jobs.php
// (not server push), so it only runs while the app is open.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import { userSession } from './session';

const CHANNEL_ID = 'ejr_mechanic_v2'; // new ID forces fresh channel settings

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSeenJobId = 0;
let isFirstCheck = true;

/**
 * Expo Go on Android cannot load the notifications native module as of SDK 53.
 * Keep the import lazy so the mechanic area can still open and poll for jobs in
 * Expo Go; development/production builds retain the native alert.
 */
async function notifications() {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;
  try {
    return await import('expo-notifications');
  } catch (e) {
    console.warn('[Notification] Native notifications are unavailable:', e);
    return null;
  }
}

export async function initNotifications() {
  // Local notifications aren't supported in the browser, and requesting
  // permission there just pops a browser prompt.
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return;

  const Notifications = await notifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Mechanic Notifications',
      description: 'Alerts for new job assignments',
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
    });
  }

  try {
    await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.log('[Notification] Permission request failed:', e);
  }
}

async function checkNewJobs() {
  if (!userSession.isMechanic) return;

  try {
    const res = await api.getMechanicJobs();
    const jobs: Record<string, any>[] = res.jobs ?? [];
    if (jobs.length === 0) return;

    const idOf = (j: Record<string, any>) => parseInt(String(j.id), 10) || 0;
    const maxId = Math.max(...jobs.map(idOf));

    if (isFirstCheck) {
      lastSeenJobId = maxId;
      isFirstCheck = false;
      return;
    }

    if (maxId > lastSeenJobId) {
      const newest = jobs.find((j) => idOf(j) === maxId)!;
      const Notifications = await notifications();
      if (Notifications) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Job Assignment',
            body: `Customer: ${newest.customer_name} - ${newest.service_type}`,
            data: { jobId: String(maxId) },
          },
          trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
        });
      }
      lastSeenJobId = maxId;
    }
  } catch (e) {
    console.log('[Notification] Poll failed:', e);
  }
}

export function startPolling() {
  if (Platform.OS === 'web') return;
  stopPolling();
  isFirstCheck = true;
  pollTimer = setInterval(checkNewJobs, 30_000);
  checkNewJobs();
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
