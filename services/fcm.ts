import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app } from './firebase';
import { registerFcmTokenRemote, unregisterFcmTokenRemote } from './cloudFunctions';

let messaging: Messaging | null = null;
let currentToken: string | null = null;

function getVapidKey(): string | undefined {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
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

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerFcmToken(_userId: string): Promise<string | null> {
  const vapidKey = getVapidKey();
  if (!vapidKey) {
    console.warn('VITE_FIREBASE_VAPID_KEY not set — push notifications disabled.');
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const instance = await getMessagingInstance();
  if (!instance) return null;

  try {
    const token = await getToken(instance, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    if (!token) return null;

    if (token !== currentToken) {
      await registerFcmTokenRemote(token);
      currentToken = token;
    }

    onMessage(instance, (payload) => {
      const title = payload.notification?.title || 'NovaSpace';
      const body = payload.notification?.body || '';
      if (document.visibilityState === 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });

    return token;
  } catch (err) {
    console.error('FCM registration failed', err);
    return null;
  }
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
