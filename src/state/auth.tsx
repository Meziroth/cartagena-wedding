// Who is signed in. With example data, that's always Nick; with Supabase it follows the real session.
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authErrorKey, type AuthErrorKey } from '../lib/authErrors';
import { ARRIVED_FOR, supabase } from '../lib/supabase';
import { MOCK_USERS } from '../mock/mockData';

export interface AuthUser { id: string; email: string }

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthCtx {
  status: AuthStatus;
  user: AuthUser | null;
  /** Arrived from an invite or password-reset link, so they need to choose a password first. */
  mustSetPassword: boolean;
  /** An emailed link that didn't work (expired, already used…), shown on the sign-in screen. */
  linkError: AuthErrorKey | null;
  passwordSet(): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const MOCK_USER: AuthUser = { id: MOCK_USERS.nick, email: 'nick@example.com' };

const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'signedIn');
  const [user, setUser] = useState<AuthUser | null>(supabase ? null : MOCK_USER);
  const [mustSetPassword, setMustSetPassword] = useState(false);
  const [linkError, setLinkError] = useState<AuthErrorKey | null>(null);
  const userId = useRef<string | null>(null);

  const apply = useCallback((next: AuthUser | null) => {
    // Token refreshes fire often; only react when the person actually changes.
    if (next?.id !== userId.current) {
      // Never show one person's cached data to the next.
      queryClient.clear();
      userId.current = next?.id ?? null;
      setUser(next);
    }
    setStatus(next ? 'signedIn' : 'signedOut');
  }, [queryClient]);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    let live = true;

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled below, together with any link error
      if (event === 'PASSWORD_RECOVERY') setMustSetPassword(true);
      if (event === 'SIGNED_OUT') setMustSetPassword(false);
      apply(toUser(session?.user));
    });

    (async () => {
      const { error } = await sb.auth.initialize();
      const { data } = await sb.auth.getSession();
      if (!live) return;
      if (error) {
        // A failed link leaves #error=… in the address bar, which the router would read as a page.
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setLinkError(authErrorKey(error) === 'generic' ? 'linkExpired' : authErrorKey(error));
      }
      if (data.session && ARRIVED_FOR) setMustSetPassword(true);
      apply(toUser(data.session?.user));
    })();

    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [apply]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // 'local' signs out this device only, and works offline.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const passwordSet = useCallback(() => setMustSetPassword(false), []);

  const value = useMemo(
    () => ({ status, user, mustSetPassword, linkError, passwordSet, signOut }),
    [status, user, mustSetPassword, linkError, passwordSet, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
