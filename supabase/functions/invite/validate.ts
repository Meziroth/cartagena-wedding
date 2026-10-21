// Checks the invite form's request body. Plain TypeScript with no Deno APIs, so Vitest can test it too.

export type InviteRole = 'owner' | 'planner';

export interface Invite {
  email: string;
  displayName: string;
  role: InviteRole;
  /** Where the emailed link returns to. Supabase only honors addresses on the project's redirect allow list. */
  redirectTo?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInvite(body: unknown): { invite: Invite } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Send the invitation details as JSON.' };
  const b = body as Record<string, unknown>;

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) return { error: 'Enter a valid email address.' };

  const displayName = typeof b.displayName === 'string' ? b.displayName.trim() : '';
  if (!displayName) return { error: 'Enter their name.' };
  if (displayName.length > 60) return { error: 'Keep the name under 60 characters.' };

  if (b.role !== 'owner' && b.role !== 'planner') return { error: 'Choose Owner or Planner.' };

  let redirectTo: string | undefined;
  if (typeof b.redirectTo === 'string') {
    try {
      const u = new URL(b.redirectTo);
      if (u.protocol === 'https:' || u.protocol === 'http:') redirectTo = u.toString();
    } catch { /* ignored: Supabase falls back to the project's Site URL */ }
  }

  return { invite: { email, displayName, role: b.role, redirectTo } };
}
