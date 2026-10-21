// Service worker: lets the planner open without a connection, shows push notifications, and opens the
// planner when one is tapped. Paths are relative to this file, which sits at the app's base path.
//
// Offline: the page itself is fetched network-first (so a new version shows as soon as you're online) and
// falls back to the last copy; the built files under assets/ have content hashes in their names, so they're
// served from the cache once fetched. Supabase data isn't cached here; the app keeps its own copy.

const CACHE = 'nt-app-v1';
const scope = new URL('./', self.location.href);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(scope.href, res.clone());
        return res;
      } catch {
        return (await caches.match(scope.href)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith(scope.pathname + 'assets/') || url.pathname.startsWith(scope.pathname + 'icons/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});

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
