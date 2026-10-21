// Phone and browser notifications for this device: turning them on and off, and keeping the server's copy of
// this device's push subscription current. Sending happens in the notify Edge Function.
import { NOTIFY_KINDS, type NotifyKind } from './notifyEvents';
import { supabase, USE_MOCK } from './supabase';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export type PushSupport = 'ok' | 'needsInstall' | 'needsNewerIos' | 'unsupported' | 'notConfigured' | 'mock';

export class PushError extends Error {
  constructor(public reason: 'blocked' | 'failed') { super(reason); }
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const iosVersion = (): number | null => {
  const m = /OS (\d+)_(\d+)/.exec(navigator.userAgent);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
};

/** Whether this device can get notifications, and if not, what to tell the person. */
export function pushSupport(): PushSupport {
  if (USE_MOCK) return 'mock';
  if (!VAPID_PUBLIC_KEY) return 'notConfigured';
  const apis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos()) {
    // Apple allows web notifications only for Home Screen apps, from iOS 16.4.
    const v = iosVersion();
    if (v !== null && v < 16.04) return 'needsNewerIos';
    if (!isStandalone()) return 'needsInstall';
  }
  return apis ? 'ok' : 'unsupported';
}

export const permission = (): NotificationPermission | 'unsupported' =>
  'Notification' in window ? Notification.permission : 'unsupported';

/** Registers the service worker that shows notifications. Safe to call on every start. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((e) => console.warn('Service worker not registered', e));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new PushError('failed')), 10_000));
  return Promise.race([ready, timeout]);
}

function b64uToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function save(weddingId: string, sub: PushSubscription, kinds: NotifyKind[]): Promise<void> {
  const json = sub.toJSON();
  const { error } = await supabase!.rpc('save_push_subscription', {
    p_wedding: weddingId, p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
    p_kinds: kinds, p_user_agent: navigator.userAgent,
  });
  if (error) throw new PushError('failed');
}

/** This device's notification settings as the server has them, or null when they're off here. */
export async function loadDeviceSettings(): Promise<{ kinds: NotifyKind[] } | null> {
  if (!supabase || permission() !== 'granted') return null;
  const sub = await currentSubscription();
  if (!sub) return null;
  // RLS only returns our own rows: if someone else took this device over, it counts as off for us.
  const { data } = await supabase.from('push_subscriptions').select('kinds').eq('endpoint', sub.endpoint).maybeSingle();
  return data ? { kinds: data.kinds as NotifyKind[] } : null;
}

/** Turns notifications on for this device. Call straight from a tap: iPhone only asks for permission then. */
export async function enablePush(weddingId: string, kinds: NotifyKind[] = [...NOTIFY_KINDS]): Promise<void> {
  const answer = await Notification.requestPermission();
  if (answer !== 'granted') throw new PushError('blocked');
  const reg = await registration();
  const key = b64uToBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older key can't receive our messages; replace it.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await save(weddingId, sub, kinds);
}

export async function updateKinds(weddingId: string, kinds: NotifyKind[]): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new PushError('failed');
  await save(weddingId, sub, kinds);
}

/** Turns notifications off for this device (also used when signing out, so a shared phone stops getting them). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Sends a test notification to this person's own devices. */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase!.functions.invoke('notify', { body: { test: true } });
  if (error) throw new PushError('failed');
}

/**
 * On start: browsers occasionally replace a subscription. If notifications are on here but the server
 * doesn't know this endpoint, save it again with the kinds last chosen on this device.
 */
export async function resyncPush(weddingId: string, userId: string): Promise<void> {
  if (pushSupport() !== 'ok' || permission() !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  const storeKey = `nt-push:${userId}`;
  let stored: { endpoint: string; kinds: NotifyKind[] } | null = null;
  try { stored = JSON.parse(localStorage.getItem(storeKey) ?? 'null'); } catch { /* none */ }
  if (stored && stored.endpoint !== sub.endpoint) await save(weddingId, sub, stored.kinds).catch(() => {});
}

/** Remembers what this device chose, for resyncPush(). */
export function rememberDevice(userId: string, kinds: NotifyKind[] | null): void {
  try {
    const key = `nt-push:${userId}`;
    if (!kinds) { localStorage.removeItem(key); return; }
    void currentSubscription().then((sub) => {
      if (sub) localStorage.setItem(key, JSON.stringify({ endpoint: sub.endpoint, kinds }));
    });
  } catch { /* storage unavailable: resync just won't run */ }
}
