import { deleteToken, getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { registerFcmTokenRemote, unregisterFcmTokenRemote } from './cloudFunctions';

let messaging: Messaging | null = null;
let currentToken: string | null = null;
let foregroundHandlerAttached = false;

/** Firebase SDK default Web Push key — used when no project-specific key is configured. */
const FIREBASE_DEFAULT_VAPID_KEY =
  'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4';

export type NotificationSupportStatus =
  | { supported: false; reason: 'unsupported' }
  | { supported: true; permission: NotificationPermission; vapidConfigured: boolean };

function getVapidKey(): string {
  const envKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  const configKey = (firebaseConfig as { vapidKey?: string }).vapidKey;
  return envKey?.trim() || configKey?.trim() || FIREBASE_DEFAULT_VAPID_KEY;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (messaging) return messaging;
  try {
    messaging = getMessaging(app);
    return messaging;
  } catch {
    return null;
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

function attachForegroundHandler(instance: Messaging): void {
  if (foregroundHandlerAttached) return;
  foregroundHandlerAttached = true;
  onMessage(instance, (payload) => {
    const title = payload.notification?.title || 'NovaSpace';
    const body = payload.notification?.body || '';
    if (document.visibilityState === 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  });
}

export function getNotificationSupportStatus(): NotificationSupportStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'unsupported' };
  }
  const envKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  const configKey = (firebaseConfig as { vapidKey?: string }).vapidKey;
  return {
    supported: true,
    permission: Notification.permission,
    vapidConfigured: !!(envKey?.trim() || configKey?.trim()),
  };
}

export function getNotificationUserMessage(status: NotificationSupportStatus): string | null {
  if (!status.supported && status.reason === 'unsupported') {
    return 'This browser does not support push notifications.';
  }
  if (status.supported && status.permission === 'denied') {
    return 'Notifications are blocked in your browser settings. Allow notifications for novaspace.work to enable them here.';
  }
  return null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function syncNotificationRegistrationState(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const instance = await getMessagingInstance();
  if (!instance) return false;

  try {
    const token = await getToken(instance, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: await getServiceWorkerRegistration(),
    });
    if (token) {
      currentToken = token;
      attachForegroundHandler(instance);
      return true;
    }
  } catch {
    /* not registered on this device */
  }
  return false;
}

export async function registerFcmToken(_userId: string): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const instance = await getMessagingInstance();
  if (!instance) return null;

  try {
    const token = await getToken(instance, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: await getServiceWorkerRegistration(),
    });

    if (!token) return null;

    if (token !== currentToken) {
      await registerFcmTokenRemote(token);
      currentToken = token;
    }

    attachForegroundHandler(instance);
    return token;
  } catch (err) {
    console.error('FCM registration failed', err);
    return null;
  }
}

export async function disableFcmNotifications(): Promise<boolean> {
  const instance = await getMessagingInstance();
  if (!instance) {
    await unregisterFcmToken();
    return true;
  }

  try {
    const token = currentToken || (await getToken(instance, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: await getServiceWorkerRegistration(),
    }).catch(() => null));

    if (token) {
      await deleteToken(instance);
      await unregisterFcmTokenRemote(token);
    }
  } catch (err) {
    console.error('FCM disable failed', err);
    return false;
  } finally {
    currentToken = null;
  }

  return true;
}

export async function unregisterFcmToken(): Promise<void> {
  if (currentToken) {
    try {
      await unregisterFcmTokenRemote(currentToken);
    } catch {
      /* ignore */
    }
    currentToken = null;
  }
}

export function isFcmRegistered(): boolean {
  return currentToken !== null;
}
