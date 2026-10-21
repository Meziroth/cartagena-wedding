// Invites someone to the wedding. Only owners may call it. It runs with the service role, whose key lives only in
// Edge Function secrets (Supabase provides SUPABASE_SERVICE_ROLE_KEY automatically) and never reaches the browser.
//
// Deploy: npx supabase functions deploy invite
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { parseInvite } from './validate.ts';

const CORS = {
  // The app sends the signed-in user's token, not cookies, so any origin is safe here.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Finds an existing account by email. The admin API has no lookup by email; a wedding has a handful of users. */
async function findUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: 'Your session has expired. Sign in again, then retry.' }, 401);

    const parsed = parseInvite(await req.json().catch(() => null));
    if ('error' in parsed) return reply({ error: parsed.error }, 400);
    const { email, displayName, role, redirectTo } = parsed.invite;

    const { data: caller, error: callerErr } = await admin.from('members')
      .select('wedding_id, role').eq('user_id', auth.user.id).limit(1).maybeSingle();
    if (callerErr) throw callerErr;
    if (caller?.role !== 'owner') return reply({ error: 'Only Nick and Thuraya can invite people.' }, 403);

    const { data: existing, error: existingErr } = await admin.from('members')
      .select('user_id').eq('wedding_id', caller.wedding_id).eq('email', email).limit(1).maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return reply({ status: 'already' });

    let userId: string | null = null;
    let status: 'invited' | 'added' = 'invited';
    const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: displayName } });
    if (invited.data.user) {
      userId = invited.data.user.id;
    } else if (invited.error?.code === 'email_exists') {
      // They already have an account (for example, created in the Supabase dashboard): add them without an email.
      userId = await findUserId(admin, email);
      status = 'added';
    } else if (invited.error?.code === 'over_email_send_rate_limit') {
      return reply({ error: 'Supabase has hit its email limit for now. Wait an hour, or create their account in the Supabase dashboard and invite them again here.' }, 429);
    } else {
      console.error('invite failed', invited.error);
      return reply({ error: `Supabase couldn't send the invitation (${invited.error?.message ?? 'unknown error'}). If emails aren't set up, create their account in the Supabase dashboard and invite them again here.` }, 502);
    }
    if (!userId) return reply({ error: 'Couldn’t find or create their account. Try again.' }, 500);

    const { error: insertErr } = await admin.from('members').insert({
      wedding_id: caller.wedding_id, user_id: userId, email, display_name: displayName, role,
    });
    if (insertErr && insertErr.code !== '23505') throw insertErr; // 23505: added a moment ago by someone else
    return reply({ status });
  } catch (err) {
    console.error(err);
    return reply({ error: 'Something went wrong on the server. Try again in a moment.' }, 500);
  }
});
