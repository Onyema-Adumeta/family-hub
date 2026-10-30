// Push notifications on this phone: permission, registering with the server,
// and opening the right screen when a notification is tapped.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

const STORED = 'pushToken';

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushState = 'on' | 'off' | 'blocked' | 'unavailable';

/** Screens a notification may open (anything else opens Home). */
const SCREENS = ['/', '/chores', '/rewards', '/chat', '/meals', '/lists', '/schedule', '/quests', '/settings', '/wins', '/bank', '/games'];
export function screenFor(url: unknown): string {
  if (typeof url !== 'string') return '/';
  const path = url.split('?')[0].split('#')[0];
  if (path === '/grocery') return '/lists';
  return SCREENS.includes(path) ? path : '/';
}

/**
 * Asks for permission (only if not decided yet, or when `ask` is true), gets this
 * phone's push token and saves it for the signed-in member. Never throws.
 */
export async function registerForPush(ask = true): Promise<{ state: PushState; preferences?: { tasks: boolean; rewards: boolean; chat: boolean } }> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Kinroost',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 150, 200],
      });
    }
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask && canAskAgain) ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return { state: canAskAgain ? 'off' : 'blocked' };

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const { data } = await api.post('/notifications/register-push', { token, platform: Platform.OS });
    await SecureStore.setItemAsync(STORED, token);
    return { state: 'on', preferences: data?.preferences };
  } catch (e: any) {
    // Typically: Android build without Firebase set up, or no network.
    console.warn('[push] could not register:', e?.message || e);
    return { state: 'unavailable' };
  }
}

/** Stops notifications for the current member on this phone (call before signing out). */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(STORED);
    if (token) await api.delete('/notifications/register-push', { data: { token }, timeout: 4000 });
  } catch { /* signing out anyway */ }
  try { await SecureStore.deleteItemAsync(STORED); } catch { /* ignore */ }
}

export async function savePushPreferences(p: { tasks: boolean; rewards: boolean; chat: boolean }) {
  const token = await SecureStore.getItemAsync(STORED);
  if (!token) throw new Error('Notifications are not set up on this phone');
  await api.patch('/notifications/push-preferences', { token, ...p });
}
