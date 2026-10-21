// Makes the VAPID key pair that identifies this app to push services, without printing the private key.
//   npm run gen:vapid -- mailto:you@example.com
// Writes:
//   .env                     VITE_VAPID_PUBLIC_KEY (public; the browser needs it to subscribe)
//   supabase/functions/.env  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (secret; for the notify function)
// Both files are git-ignored. Then: npx supabase secrets set --env-file supabase/functions/.env
// Keep the same keys afterwards: new keys make every existing phone subscription stop working.
import { createECDH } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const subject = process.argv[2] ?? '';
if (!/^(mailto:|https:\/\/)/.test(subject)) {
  console.error('Give a contact for the push services, e.g.  npm run gen:vapid -- mailto:you@example.com');
  process.exit(1);
}

const secretsFile = 'supabase/functions/.env';
if (existsSync(secretsFile) && /VAPID_PRIVATE_KEY=./.test(readFileSync(secretsFile, 'utf8')) && !process.argv.includes('--force')) {
  console.error(`${secretsFile} already has a key. Replacing it breaks existing subscriptions; add --force if you mean it.`);
  process.exit(1);
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const publicKey = b64u(ecdh.getPublicKey());
const privateKey = b64u(ecdh.getPrivateKey().length === 32 ? ecdh.getPrivateKey() : Buffer.concat([Buffer.alloc(32 - ecdh.getPrivateKey().length), ecdh.getPrivateKey()]));

/** Sets KEY=value in an env file, replacing an existing line or appending one. */
function setVar(file, key, value) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  writeFileSync(file, re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
}

setVar('.env', 'VITE_VAPID_PUBLIC_KEY', publicKey);
setVar(secretsFile, 'VAPID_PUBLIC_KEY', publicKey);
setVar(secretsFile, 'VAPID_PRIVATE_KEY', privateKey);
setVar(secretsFile, 'VAPID_SUBJECT', subject);
console.log(`Public key written to .env; the key pair and subject to ${secretsFile} (not printed).`);
