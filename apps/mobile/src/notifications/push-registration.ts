import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authFetch } from '@/api/client';

const INSTALLATION_ID_KEY = 'fantasy-draft.push-installation.v1';
let registrationPromise: Promise<boolean> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function createInstallationId(): string {
  const randomUUID = (
    globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  ).crypto?.randomUUID;
  return randomUUID
    ? randomUUID.call(globalThis.crypto)
    : `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function getPushInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = createInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
  return created;
}

function getEasProjectId(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (configured) return configured;
  const easProjectId = Constants.easConfig?.projectId;
  if (easProjectId) return easProjectId;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  return typeof extra?.eas?.projectId === 'string' ? extra.eas.projectId : undefined;
}

async function performRegistration(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('draft-turns', {
      name: 'Draft turn alerts',
      description: 'Alerts when your fantasy team is on the clock',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      sound: 'default',
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  const permissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return false;

  const projectId = getEasProjectId();
  const pushToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const installationId = await getPushInstallationId();
  await authFetch<void>('/notifications/push-token', {
    method: 'PUT',
    body: JSON.stringify({
      token: pushToken.data,
      installationId,
      platform: Platform.OS,
    }),
  });
  return true;
}

/** Single-flights permission/token registration and can be retried on app resume. */
export async function registerPushNotifications(): Promise<boolean> {
  if (registrationPromise) return registrationPromise;
  const promise = performRegistration()
    .catch(() => false)
    .finally(() => {
      if (registrationPromise === promise) registrationPromise = null;
    });
  registrationPromise = promise;
  return promise;
}

/** Best-effort server deactivation performed while the access token is still valid. */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const installationId = await getPushInstallationId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      await authFetch<void>(`/notifications/push-token/${encodeURIComponent(installationId)}`, {
        method: 'DELETE',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Local logout must still complete when the device is offline.
  }
}
