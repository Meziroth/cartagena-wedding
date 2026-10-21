// Loads the wedding dataset for the signed-in member, then exposes both to every screen.
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDataset } from '../data/queries';
import { useRealtime } from '../data/realtime';
import type { Dataset } from '../mock/mockData';
import type { Member } from '../types';
import { CurrencyProvider } from './currency';

interface WeddingCtx { data: Dataset; me: Member; isOwner: boolean }
const Ctx = createContext<WeddingCtx | null>(null);

export function LoadError({ onSignOut }: { onSignOut?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="boot" role="alert">
      <p>{t('app.loadError')}</p>
      <div className="auth-alt">
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>{t('app.reload')}</button>
        {onSignOut && <button type="button" className="btn ghost" onClick={onSignOut}>{t('topbar.signOut')}</button>}
      </div>
    </div>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="boot" role="status" aria-live="polite"><p className="muted">{t('app.loading')}</p></div>;
}

export function WeddingProvider({ me, onSignOut, children }: { me: Member; onSignOut?: () => void; children: ReactNode }) {
  const data = useDataset(me.wedding_id, me.user_id);
  useRealtime(me.wedding_id, me.user_id);

  // With a saved copy, a failed refresh (say, offline) keeps showing it; the offline banner explains.
  if (data.isError && !data.data) return <LoadError onSignOut={onSignOut} />;
  if (!data.data) return <Loading />;
  return (
    <Ctx.Provider value={{ data: data.data, me, isOwner: me.role === 'owner' }}>
      <CurrencyProvider userId={me.user_id}>{children}</CurrencyProvider>
    </Ctx.Provider>
  );
}

export function useWedding(): WeddingCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWedding must be used inside WeddingProvider');
  return v;
}
