// Fetches a saved link's page on the server and returns its preview title and image (og:title, og:image), so
// Pinterest, Instagram and other links show a real card. Browsers can't do this themselves (other sites don't
// allow it). Only signed-in members may call it. When anything fails it answers { title: null, image: null }
// and the app shows a plain card with the site's name.
//
// Deploy: npx supabase functions deploy link-preview
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { googleImagesShortcut, isBlockedAddress, parsePreview, type Preview } from './parse.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const NONE: Preview = { title: null, image: null };
const MAX_BYTES = 750_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 7000;

/** Every hop must be a public web address, including where redirects lead and what the name resolves to. */
async function allowed(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.port && !['80', '443'].includes(url.port)) return false;
  if (isBlockedAddress(url.hostname)) return false;
  try {
    const ips = [
      ...await Deno.resolveDns(url.hostname, 'A').catch(() => [] as string[]),
      ...await Deno.resolveDns(url.hostname, 'AAAA').catch(() => [] as string[]),
    ];
    return !ips.some((ip) => isBlockedAddress(ip));
  } catch {
    return true; // DNS lookups unavailable: the hostname checks above still apply
  }
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let i = 0;
  for (const c of chunks) { all.set(c.subarray(0, Math.min(c.length, size - i)), i); i += c.length; }
  return new TextDecoder().decode(all.subarray(0, Math.min(size, MAX_BYTES)));
}

async function preview(start: URL): Promise<Preview> {
  let url = start;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const shortcut = googleImagesShortcut(url);
    if (shortcut) return shortcut;
    if (!(await allowed(url))) return NONE;
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        // Many sites only include og: tags for link-preview bots.
        'User-Agent': 'Mozilla/5.0 (compatible; WeddingPlannerLinkPreview/1.0; +https://github.com/)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en,es;q=0.8',
      },
    });
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) {
      await res.body?.cancel();
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
      await res.body?.cancel();
      return NONE;
    }
    return parsePreview(await readLimited(res), url.toString());
  }
  return NONE;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return reply({ error: 'Sign in again.' }, 401);
  const { data: member } = await admin.from('members').select('user_id').eq('user_id', auth.user.id).limit(1).maybeSingle();
  if (!member) return reply({ error: 'You’re not in this wedding.' }, 403);

  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  let url: URL;
  try {
    url = new URL(String(body?.url ?? ''));
  } catch {
    return reply({ error: 'Send { url }.' }, 400);
  }
  try {
    return reply(await preview(url));
  } catch (err) {
    console.warn('preview failed', url.hostname, err);
    return reply(NONE);
  }
});
