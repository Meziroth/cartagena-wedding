// Turns Supabase auth errors into friendly messages (keys under "auth.errors" in en.json).

export type AuthErrorKey =
  | 'wrongPassword' | 'notInvited' | 'tooMany' | 'emailLimit' | 'weakPassword' | 'samePassword'
  | 'linkExpired' | 'offline' | 'generic';

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'wrongPassword',
  // Magic links never create accounts here, so an unknown email gets one of these.
  otp_disabled: 'notInvited',
  signup_disabled: 'notInvited',
  user_not_found: 'notInvited',
  email_address_not_authorized: 'notInvited',
  over_request_rate_limit: 'tooMany',
  over_email_send_rate_limit: 'emailLimit',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  otp_expired: 'linkExpired',
  flow_state_expired: 'linkExpired',
  flow_state_not_found: 'linkExpired',
};

export function authErrorKey(err: unknown): AuthErrorKey {
  const e = (err ?? {}) as { code?: string; status?: number; name?: string; message?: string; details?: { code?: string } };
  const code = e.code ?? e.details?.code;
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'offline';
  if (e.status === 429) return 'tooMany';
  if (/signups? not allowed/i.test(e.message ?? '')) return 'notInvited';
  if (/expired|invalid.*link/i.test(e.message ?? '')) return 'linkExpired';
  return 'generic';
}
