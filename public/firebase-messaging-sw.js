/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCRzC0nSmZY-Y7mBZbdsVVT4Q-vEKf4GaQ',
  authDomain: 'refined-legend-420223.firebaseapp.com',
  projectId: 'refined-legend-420223',
  messagingSenderId: '1098807214267',
  appId: '1:1098807214267:web:a89433554bc1f5d82fe99e',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'NovaSpace';
  const options = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
