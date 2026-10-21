// Nothing of the planner renders without a session and a membership. In order: wait for the session,
// sign in, choose a password (after an invite or reset link), set up or wait for an invite, then the app.
import type { ReactNode } from 'react';
import { useCanSetUp, useMe } from '../data/queries';
import { useAuth } from '../state/auth';
import { LoadError, Loading, WeddingProvider } from '../state/wedding';
import { NoMembership, SetPassword, SignIn } from '../views/Auth';

function Membership({ userId, children }: { userId: string; children: ReactNode }) {
  const { signOut } = useAuth();
  const me = useMe(userId);
  const notMember = me.isSuccess && me.data === null;
  const canSetUp = useCanSetUp(notMember);
  const onSignOut = () => void signOut();

  if (me.isError || canSetUp.isError) return <LoadError onSignOut={onSignOut} />;
  if (me.isPending || (notMember && canSetUp.isPending)) return <Loading />;
  if (!me.data) return <NoMembership canSetUp={canSetUp.data === true} />;
  return <WeddingProvider me={me.data} onSignOut={onSignOut}>{children}</WeddingProvider>;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { status, user, mustSetPassword } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut' || !user) return <SignIn />;
  if (mustSetPassword) return <SetPassword />;
  return <Membership userId={user.id}>{children}</Membership>;
}
