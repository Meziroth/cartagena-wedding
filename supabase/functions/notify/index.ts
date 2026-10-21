// Sends phone notifications about a change someone just saved: a new or edited note, new inspiration, or a
// checked-off task. The app calls it after each such save with { kind, id }. It checks the caller is in the
// wedding, reads the row itself (so the text can't be made up by the caller), and pushes to everyone else's
// devices that asked for that kind of notification.
//
// Secrets (npx supabase secrets set …): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Deploy: npx supabase functions deploy notify
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { sendPush, type VapidKeys } from '../_shared/webpush.ts';
import { buildMessage, parseNotify, type NotifyKind } from './message.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TABLE: Record<NotifyKind, string> = { note_created: 'notes', note_edited: 'notes', idea_added: 'ideas', task_done: 'tasks' };
/** Only rows changed this recently can trigger a notification, so old rows can't be replayed to spam phones. */
const FRESH_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  const vapid: VapidKeys = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? '',
  };
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) return reply({ error: 'Notifications aren’t set up yet.' }, 503);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: 'Sign in again.' }, 401);

    const parsed = parseNotify(await req.json().catch(() => null));
    if ('error' in parsed) return reply({ error: parsed.error }, 400);
    const { kind, id, test } = parsed.event;

    const { data: actor } = await admin.from('members').select('wedding_id, display_name')
      .eq('user_id', auth.user.id).limit(1).maybeSingle();
    if (!actor) return reply({ error: 'You’re not in this wedding.' }, 403);

    let message;
    let recipients;
    if (test) {
      // "Send a test notification": only to the caller's own devices.
      message = buildMessage('test', actor.display_name, {});
      recipients = admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', auth.user.id);
    } else {
      const { data: row } = await admin.from(TABLE[kind!]).select('*').eq('id', id!).eq('wedding_id', actor.wedding_id).maybeSingle();
      if (!row) return reply({ error: 'Not found.' }, 404);
      const changedAt = new Date(row.updated_at ?? row.created_at).getTime();
      if (Date.now() - changedAt > FRESH_MS) return reply({ sent: 0, skipped: 'stale' });
      message = buildMessage(kind!, actor.display_name, row);
      recipients = admin.from('push_subscriptions').select('id, endpoint, p256dh, auth')
        .eq('wedding_id', actor.wedding_id).neq('user_id', auth.user.id).contains('kinds', [kind]);
    }

    const { data: subs, error } = await recipients;
    if (error) throw error;
    const results = await Promise.allSettled((subs ?? []).map((s) => sendPush(s, message, vapid)));
    // Forget devices the push service says are gone (app deleted, permission revoked).
    const gone = (subs ?? []).filter((_, i) => { const r = results[i]; return r.status === 'fulfilled' && r.value.gone; });
    if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone.map((s) => s.id));
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.status < 300).length;
    results.forEach((r) => { if (r.status === 'rejected' || r.value.status >= 300) console.warn('push failed', r); });
    return reply({ sent, removed: gone.length });
  } catch (err) {
    console.error(err);
    return reply({ error: 'Something went wrong sending notifications.' }, 500);
  }
});
