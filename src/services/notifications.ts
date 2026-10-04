// Port of lib/services/notification_service.dart.
//
// Mechanics get a local notification when a new job shows up. As in the
// Flutter version this is a 30s foreground poll of get_mechanic_jobs.php
// (not server push), so it only runs while the app is open.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { userSession } from './session';

const CHANNEL_ID = 'ejr_mechanic_v2'; // new ID forces fresh channel settings

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSeenJobId = 0;
let isFirstCheck = true;

export async function initNotifications() {
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
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Job Assignment',
          body: `Customer: ${newest.customer_name} - ${newest.service_type}`,
          data: { jobId: String(maxId) },
        },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      });
      lastSeenJobId = maxId;
    }
  } catch (e) {
    console.log('[Notification] Poll failed:', e);
  }
}

export function startPolling() {
  stopPolling();
  isFirstCheck = true;
  pollTimer = setInterval(checkNewJobs, 30_000);
  checkNewJobs();
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
