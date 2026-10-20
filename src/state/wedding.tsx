// Loads the signed-in member and the wedding dataset once, then exposes them to every screen.
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDataset, useMe } from '../data/queries';
import type { Dataset } from '../mock/mockData';
import type { Member } from '../types';
import { CurrencyProvider } from './currency';

interface WeddingCtx { data: Dataset; me: Member; isOwner: boolean }
const Ctx = createContext<WeddingCtx | null>(null);

export function WeddingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  const data = useDataset();

  if (me.isError || data.isError) {
    return (
      <div className="boot" role="alert">
        <p>{t('app.loadError')}</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>{t('app.reload')}</button>
      </div>
    );
  }
  if (!me.data || !data.data) {
    return <div className="boot" role="status" aria-live="polite"><p className="muted">{t('app.loading')}</p></div>;
  }
  return (
    <Ctx.Provider value={{ data: data.data, me: me.data, isOwner: me.data.role === 'owner' }}>
      <CurrencyProvider userId={me.data.user_id}>{children}</CurrencyProvider>
    </Ctx.Provider>
  );
}

export function useWedding(): WeddingCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWedding must be used inside WeddingProvider');
  return v;
}
