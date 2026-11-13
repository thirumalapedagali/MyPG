import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

/** Must match the channel id the backend names in FcmSender. */
const CHANNEL_ID = 'default';

// Show a notification banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;

/** Asks for permission and returns this phone's FCM token, or null when push is unavailable (no permission, simulator, no Firebase setup). */
async function getFcmToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'MyStay updates',
    // The enum is exported (see build/NotificationChannelManager.types), but the import/namespace rule cannot see through the re-export.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  const existing = await Notifications.getPermissionsAsync();
  console.log("existing",existing)
  const status = existing.granted ? 'granted' : (await Notifications.requestPermissionsAsync()).status;
  console.log("status",status)
  if (status !== 'granted') return null;
  try {
    console.log("Attempting to fetch raw device push token...");
    const token = await Notifications.getDevicePushTokenAsync();
    console.log("getDevicePushTokenAsync successful:", token);
    return typeof token.data === 'string' ? token.data : null;
  } catch (e) {
    console.error("getDevicePushTokenAsync failed with error:", e);
    throw e;
  }
}

const send = (token: string) =>
  api('/api/me/devices', { method: 'POST', body: { token, platform: Platform.OS } });

/** Tells the server where to reach this phone. Safe to call on every sign-in; never throws, since push is optional. */
export async function registerForPush(): Promise<void> {
  try {
    const token = await getFcmToken();
    if (!token) {
      console.log('No push token returned (either not Android, permission denied, or setup missing).');
      return;
    }
    registeredToken = token;
    await send(token);
    console.log('Push token successfully registered with backend:', token);
  } catch (e) {
    // Push is a nice-to-have: a missing Firebase config or a flaky network must not get in the user's way.
    console.warn('Push token registration failed during flow:', e);
  }
}

/** Keeps the server current if Firebase rolls this phone's token while the app is running. */
export function watchPushToken(): () => void {
  if (Platform.OS !== 'android') return () => {};
  const sub = Notifications.addPushTokenListener((t) => {
    if (typeof t.data !== 'string' || !registeredToken) return;
    registeredToken = t.data;
    send(t.data).catch(() => {});
  });
  return () => sub.remove();
}

/** Stops notifications for the user who is signing out. Call it while the session token is still valid. */
export async function unregisterFromPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await api(`/api/me/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    // The token is also dropped on the server when FCM reports it dead, so a missed call is harmless.
  }
}
