// Shown while the device is offline (edits wait and are saved when the connection returns), or when the server
// can't be reached (for example, a paused Supabase project) and the screen shows this device's saved copy.
import { useIsMutating } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useWedding } from '../state/wedding';
import { Icon } from './Icon';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => { window.removeEventListener('online', onChange); window.removeEventListener('offline', onChange); };
};

function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const waiting = useIsMutating({ mutationKey: ['change'] });
  const { refreshFailed } = useWedding();
  return (
    // The live region stays mounted so the change is announced.
    <div role="status" aria-live="polite">
      {!online && (
        <div className="banner offline">
          <Icon name="warn" size={18} />
          <span><b>{t('offline.title')}</b> {waiting ? t('offline.waiting', { count: waiting }) : t('offline.body')}</span>
        </div>
      )}
      {online && refreshFailed && (
        <div className="banner offline">
          <Icon name="warn" size={18} />
          <span><b>{t('offline.serverTitle')}</b> {t('offline.serverBody')}</span>
        </div>
      )}
    </div>
  );
}
