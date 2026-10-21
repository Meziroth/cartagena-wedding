// Web Push, using only Web Crypto so it runs the same in Deno (Edge Functions) and Node (tests):
//   * RFC 8291 message encryption (aes128gcm content coding, RFC 8188)
//   * RFC 8292 VAPID, which identifies this app to the push service (Apple, Google, Mozilla…)

export interface PushSubscriptionKeys {
  endpoint: string;
  /** The browser's public key, base64url (65-byte uncompressed P-256 point). */
  p256dh: string;
  /** The browser's auth secret, base64url (16 bytes). */
  auth: string;
}

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 point. Also given to the browser when subscribing. */
  publicKey: string;
  /** base64url, the 32-byte private scalar ("d"). Secret: Edge Function secrets only. */
  privateKey: string;
  /** mailto: or https: contact for the push services, e.g. "mailto:nick@example.com". */
  subject: string;
}

const enc = new TextEncoder();

export function b64uEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

const RECORD_SIZE = 4096;

/**
 * Encrypts a payload for one subscription (RFC 8291). `salt` and `senderKeys` are only passed by tests;
 * normally both are fresh and random for every message.
 */
export async function encryptPayload(
  payload: Uint8Array, sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  opts: { salt?: Uint8Array; senderKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error('Push payload too large');
  const uaPublic = b64uDecode(sub.p256dh);
  const authSecret = b64uDecode(sub.auth);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const sender = opts.senderKeys
    ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the payload, then the 0x02 "last record" delimiter.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));

  // Header: salt (16) | record size (uint32) | key id length (1) | key id (the sender's public key)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

/** The VAPID Authorization header for a push service (RFC 8292), valid for 12 hours. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const pub = b64uDecode(vapid.publicKey);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o: object) => b64uEncode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({
    aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject,
  })}`;
  // Web Crypto ECDSA signatures are already the raw r || s that JWT expects.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64uEncode(sig)}, k=${vapid.publicKey}`;
}

export interface PushResult {
  status: number;
  /** The push service says this subscription is dead (the app was removed, or notifications turned off). */
  gone: boolean;
}

/** Sends one notification. `ttl` is how long the push service may hold it for an offline device. */
export async function sendPush(sub: PushSubscriptionKeys, payload: unknown, vapid: VapidKeys, ttl = 24 * 3600): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body,
  });
  await res.body?.cancel();
  return { status: res.status, gone: res.status === 404 || res.status === 410 };
}
