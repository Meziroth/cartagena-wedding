// Service worker: shows push notifications and opens the planner when one is tapped.
// (Offline caching arrives in Phase 7.) Paths are relative to this file, which sits at the app's base path.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { body: event.data ? event.data.text() : '' }; }
  const base = new URL('./', self.location.href).href;
  // iPhone requires every push to show a notification, so always show one.
  event.waitUntil(self.registration.showNotification(msg.title || 'Wedding planner', {
    body: msg.body || '',
    tag: msg.tag || undefined,
    icon: base + 'icons/icon-192.png',
    badge: base + 'icons/badge-96.png',
    data: { url: base + (msg.url || '') },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || new URL('./', self.location.href).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => w.url.startsWith(new URL('./', self.location.href).href));
    if (open) {
      await open.focus();
      if ('navigate' in open) return open.navigate(url).catch(() => undefined);
      return undefined;
    }
    return self.clients.openWindow(url);
  })());
});

// The subscription can be replaced by the browser; tell the open app so it can save the new one.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((wins) => {
    wins.forEach((w) => w.postMessage({ type: 'pushsubscriptionchange' }));
  }));
});
