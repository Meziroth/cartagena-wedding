// Everything someone sees before the planner itself: sign in, choose a password, set up the wedding,
// or wait for an invitation.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TileDefs, TilesBackground } from '../components/Icon';
import { qk } from '../data/queries';
import { dataSource, FriendlyError } from '../data/source';
import { authErrorKey, type AuthErrorKey } from '../lib/authErrors';
import { redirectUrl, supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

const MIN_PASSWORD = 8;

function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="auth" id="main">
      <TileDefs />
      <TilesBackground />
      <div className="auth-card">
        <p className="auth-names" aria-hidden="true">Nick <span className="amp">&amp;</span> Thuraya</p>
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
      </div>
    </main>
  );
}

function FormError({ id, message }: { id: string; message: string | null }) {
  // Always mounted so screen readers announce the message when it appears.
  return <p id={id} className="form-error" role="alert">{message}</p>;
}

function PasswordInput({ id, value, onChange, autoComplete, describedBy }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; describedBy?: string;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <div className="pw">
      <input id={id} type={shown ? 'text' : 'password'} value={value} required autoComplete={autoComplete}
        aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="btn ghost small" aria-pressed={shown} aria-controls={id} onClick={() => setShown((s) => !s)}>
        {t('auth.showPassword')}
      </button>
    </div>
  );
}

type Mode = 'password' | 'magic' | 'forgot';

export function SignIn() {
  const { t } = useTranslation();
  const { linkError } = useAuth();
  const ids = useId();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(linkError);
  const [sentTo, setSentTo] = useState<{ email: string; kind: 'magic' | 'forgot' } | null>(null);

  const switchTo = (m: Mode) => { setMode(m); setError(null); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const address = email.trim();
    const { error: err } =
      mode === 'password'
        ? await supabase.auth.signInWithPassword({ email: address, password })
        : mode === 'magic'
          // shouldCreateUser: false keeps it invite-only, even if sign-ups were switched back on.
          ? await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: redirectUrl() } })
          : await supabase.auth.resetPasswordForEmail(address, { redirectTo: redirectUrl() });
    setBusy(false);
    if (err) setError(authErrorKey(err));
    else if (mode !== 'password') setSentTo({ email: address, kind: mode });
    // A successful password sign-in is picked up by AuthProvider.
  };

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.checkEmail')} intro={t(sentTo.kind === 'magic' ? 'auth.sentMagic' : 'auth.sentReset', { email: sentTo.email })}>
        <p className="muted small">{t('auth.sentTip')}</p>
        <button type="button" className="btn" onClick={() => { setSentTo(null); switchTo('password'); }}>{t('auth.backToSignIn')}</button>
      </AuthLayout>
    );
  }

  const errId = `${ids}-err`;
  const title = t(mode === 'forgot' ? 'auth.forgotTitle' : 'auth.signInTitle');
  const intro = t(mode === 'forgot' ? 'auth.forgotIntro' : mode === 'magic' ? 'auth.magicIntro' : 'auth.signInIntro');

  return (
    <AuthLayout title={title} intro={intro}>
      <form className="auth-form" onSubmit={submit} aria-describedby={errId}>
        <div className="field">
          <label htmlFor={`${ids}-email`}>{t('auth.email')}</label>
          <input id={`${ids}-email`} type="email" value={email} required autoComplete="email" inputMode="email"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === 'password' && (
          <div className="field">
            <label htmlFor={`${ids}-pw`}>{t('auth.password')}</label>
            <PasswordInput id={`${ids}-pw`} value={password} onChange={setPassword} autoComplete="current-password" />
          </div>
        )}
        <FormError id={errId} message={error && t(`auth.errors.${error}`)} />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? t('auth.working') : t(mode === 'password' ? 'auth.signIn' : mode === 'magic' ? 'auth.sendLink' : 'auth.sendReset')}
        </button>
      </form>
      <div className="auth-alt">
        {mode !== 'password' && <button type="button" className="btn ghost small" onClick={() => switchTo('password')}>{t('auth.usePassword')}</button>}
        {mode !== 'magic' && <button type="button" className="btn ghost small" onClick={() => switchTo('magic')}>{t('auth.useMagic')}</button>}
        {mode !== 'forgot' && <button type="button" className="btn ghost small" onClick={() => switchTo('forgot')}>{t('auth.forgot')}</button>}
      </div>
      <p className="muted small">{t('auth.inviteOnly')}</p>
    </AuthLayout>
  );
}

export function SetPassword() {
  const { t } = useTranslation();
  const { user, passwordSet, signOut } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < MIN_PASSWORD) return setError(t('auth.errors.weakPassword'));
    if (password !== again) return setError(t('auth.errors.mismatch'));
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(t(`auth.errors.${authErrorKey(err)}`));
    passwordSet();
    toast(t('auth.passwordSaved'));
  };

  const errId = `${ids}-err`;
  return (
    <AuthLayout title={t('auth.setPasswordTitle')} intro={t('auth.setPasswordIntro', { email: user?.email })}>
      <form className="auth-form" onSubmit={submit} aria-describedby={errId}>
        <div className="field">
          <label htmlFor={`${ids}-pw`}>{t('auth.newPassword')}</label>
          <PasswordInput id={`${ids}-pw`} value={password} onChange={setPassword} autoComplete="new-password" describedBy={`${ids}-hint`} />
          <p id={`${ids}-hint`} className="muted small">{t('auth.passwordHint', { n: MIN_PASSWORD })}</p>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-again`}>{t('auth.passwordAgain')}</label>
          <PasswordInput id={`${ids}-again`} value={again} onChange={setAgain} autoComplete="new-password" />
        </div>
        <FormError id={errId} message={error} />
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('auth.working') : t('auth.savePassword')}</button>
      </form>
      <div className="auth-alt">
        <button type="button" className="btn ghost small" onClick={() => void signOut()}>{t('topbar.signOut')}</button>
      </div>
    </AuthLayout>
  );
}

/** Signed in, but not a member: either the very first person (set up the wedding) or waiting for an invite. */
export function NoMembership({ canSetUp }: { canSetUp: boolean }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const ids = useId();
  const [name, setName] = useState('');

  const setUp = useMutation({
    mutationFn: () => dataSource.setUpWedding(name.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me(user!.id) }),
  });
  const recheck = () => {
    void queryClient.invalidateQueries({ queryKey: qk.me(user!.id) });
    void queryClient.invalidateQueries({ queryKey: qk.canSetUp });
  };

  const signOutBtn = <button type="button" className="btn ghost small" onClick={() => void signOut()}>{t('topbar.signOut')}</button>;

  if (!canSetUp) {
    return (
      <AuthLayout title={t('auth.notInvitedTitle')} intro={t('auth.notInvitedIntro', { email: user?.email })}>
        <div className="auth-alt">
          <button type="button" className="btn primary" onClick={recheck}>{t('auth.checkAgain')}</button>
          {signOutBtn}
        </div>
      </AuthLayout>
    );
  }

  const errId = `${ids}-err`;
  const err = setUp.error;
  return (
    <AuthLayout title={t('auth.setupTitle')} intro={t('auth.setupIntro')}>
      <form className="auth-form" aria-describedby={errId} onSubmit={(e) => { e.preventDefault(); setUp.mutate(); }}>
        <div className="field">
          <label htmlFor={`${ids}-name`}>{t('auth.yourName')}</label>
          <input id={`${ids}-name`} type="text" value={name} required maxLength={60} autoComplete="given-name"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <FormError id={errId} message={err ? (err instanceof FriendlyError ? err.message : t('auth.errors.generic')) : null} />
        <button type="submit" className="btn primary" disabled={setUp.isPending}>
          {setUp.isPending ? t('auth.working') : t('auth.setupButton')}
        </button>
      </form>
      <div className="auth-alt">{signOutBtn}</div>
    </AuthLayout>
  );
}
