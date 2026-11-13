import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const NOTIFICATIONS_STORAGE_KEY = 'mypg-notifications-history';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
}

let cachedNotifications: NotificationItem[] = [];
const subscribers = new Set<(items: NotificationItem[]) => void>();

// Helper to notify all subscribers when the list of notifications changes
function notifySubscribers() {
  const list = [...cachedNotifications];
  subscribers.forEach((cb) => cb(list));
}

// Load notifications from AsyncStorage
export async function loadNotifications(): Promise<NotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      cachedNotifications = JSON.parse(raw);
    } else {
      cachedNotifications = [];
    }
  } catch (e) {
    console.error('Failed to load notifications history:', e);
    cachedNotifications = [];
  }
  notifySubscribers();
  return cachedNotifications;
}

// Save notifications to AsyncStorage
async function saveNotifications() {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(cachedNotifications));
  } catch (e) {
    console.error('Failed to save notifications history:', e);
  }
  notifySubscribers();
}

// Add a notification item manually or via listeners
export async function addNotification(title: string, body: string, id?: string): Promise<void> {
  const newItem: NotificationItem = {
    id: id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: title || 'New Notification',
    body: body || '',
    timestamp: new Date().toISOString(),
  };

  // Avoid duplicates if the same notification is processed twice
  if (cachedNotifications.some((n) => n.id === newItem.id)) {
    return;
  }

  // Prepend new notifications so they appear at the top
  cachedNotifications = [newItem, ...cachedNotifications];
  await saveNotifications();
}

// Delete a single notification by id
export async function deleteNotification(id: string): Promise<void> {
  cachedNotifications = cachedNotifications.filter((n) => n.id !== id);
  await saveNotifications();
}

// Clear all notifications
export async function clearAllNotifications(): Promise<void> {
  cachedNotifications = [];
  await saveNotifications();
}

// Subscribe to notification updates (returns an unsubscribe function)
export function subscribeNotifications(cb: (items: NotificationItem[]) => void): () => void {
  subscribers.add(cb);
  // Send current cached state immediately to the subscriber
  cb([...cachedNotifications]);
  return () => {
    subscribers.delete(cb);
  };
}

// Initialize native expo-notification event listeners
export function initNotificationListeners() {
  // 1. Listen for notifications received while the app is in the foreground
  const recvSub = Notifications.addNotificationReceivedListener((notification) => {
    const { title, body } = notification.request.content;
    const id = notification.request.identifier;
    addNotification(title ?? '', body ?? '', id);
  });

  // 2. Listen for notifications tapped by the user (app opens from background/quit)
  const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const { title, body } = response.notification.request.content;
    const id = response.notification.request.identifier;
    addNotification(title ?? '', body ?? '', id);
  });

  // Load initial list from storage immediately
  loadNotifications();

  return () => {
    recvSub.remove();
    respSub.remove();
  };
}
