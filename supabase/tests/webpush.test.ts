// The push sender is checked against http_ece, the reference implementation by the author of RFC 8188/8291:
// what we encrypt, it must decrypt with only the browser's private key and auth secret.
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto';
// @ts-expect-error http_ece has no type definitions
import ece from 'http_ece';
import { describe, expect, it } from 'vitest';
import { b64uDecode, b64uEncode, encryptPayload, vapidAuthorization } from '../functions/_shared/webpush.ts';

function fakeBrowser() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { ecdh, p256dh: b64uEncode(ecdh.getPublicKey()), auth: b64uEncode(randomBytes(16)) };
}

describe('web push encryption (RFC 8291)', () => {
  it('produces messages the browser side can decrypt', async () => {
    const browser = fakeBrowser();
    const message = JSON.stringify({ title: 'Thuraya added a note', body: 'Café lights over the courtyard ✨' });
    const body = await encryptPayload(new TextEncoder().encode(message), browser);
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: browser.ecdh, authSecret: browser.auth });
    expect(plain.toString('utf8')).toBe(message);
  });

  it('writes the aes128gcm header: salt, record size 4096, and the sender key as key id', async () => {
    const browser = fakeBrowser();
    const salt = new Uint8Array(16).fill(7);
    const body = await encryptPayload(new Uint8Array([1, 2, 3]), browser, { salt });
    expect([...body.slice(0, 16)]).toEqual([...salt]);
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(body[21]).toBe(4); // uncompressed point
    expect(body.length).toBe(21 + 65 + 3 + 1 + 16); // header + payload + delimiter + GCM tag
  });

  it('uses a fresh key and salt for every message', async () => {
    const browser = fakeBrowser();
    const a = await encryptPayload(new Uint8Array([1]), browser);
    const b = await encryptPayload(new Uint8Array([1]), browser);
    expect(b64uEncode(a.slice(0, 86))).not.toBe(b64uEncode(b.slice(0, 86)));
  });

  it('refuses payloads too big for one record', async () => {
    await expect(encryptPayload(new Uint8Array(4000), fakeBrowser())).rejects.toThrow(/too large/);
  });
});

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push service origin that verifies with the public key', async () => {
    const server = createECDH('prime256v1');
    server.generateKeys();
    const vapid = { publicKey: b64uEncode(server.getPublicKey()), privateKey: b64uEncode(server.getPrivateKey()), subject: 'mailto:nick@example.com' };
    const now = Date.UTC(2026, 9, 21);
    const header = await vapidAuthorization('https://web.push.apple.com/QGuQyavXutnMH/abc', vapid, now);

    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(vapid.publicKey);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(c)))).toEqual({
      aud: 'https://web.push.apple.com', exp: now / 1000 + 12 * 3600, sub: 'mailto:nick@example.com',
    });

    const pub = b64uDecode(vapid.publicKey);
    const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33)) } });
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64uDecode(s)));
    expect(ok).toBe(true);
  });
});
