// Wedding details → Notifications: per device, on or off, and which kinds of change to hear about.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTIFY_KINDS, type NotifyKind } from '../lib/notifyEvents';
import {
  disablePush, enablePush, loadDeviceSettings, permission, PushError, pushSupport, rememberDevice, sendTestPush, updateKinds,
} from '../lib/push';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';

export function Notifications() {
  const { t } = useTranslation();
  const { data, me } = useWedding();
  const toast = useToast();
  const support = pushSupport();
  const [loading, setLoading] = useState(support === 'ok');
  const [busy, setBusy] = useState(false);
  const [kinds, setKinds] = useState<NotifyKind[] | null>(null); // null = off on this device
  const [blocked, setBlocked] = useState(permission() === 'denied');

  useEffect(() => {
    if (support !== 'ok') return;
    let live = true;
    loadDeviceSettings()
      .then((s) => { if (live) setKinds(s?.kinds ?? null); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [support]);

  const fail = (e: unknown) => {
    if (e instanceof PushError && e.reason === 'blocked') { setBlocked(true); toast(t('push.blocked')); }
    else toast(t('push.failed'));
  };

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const all = [...NOTIFY_KINDS];
        await enablePush(data.wedding.id, all);
        setKinds(all);
        rememberDevice(me.user_id, all);
        toast(t('push.on'));
      } else {
        await disablePush();
        setKinds(null);
        rememberDevice(me.user_id, null);
        toast(t('push.off'));
      }
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const setKind = async (kind: NotifyKind, on: boolean) => {
    if (!kinds) return;
    const next = on ? [...kinds, kind] : kinds.filter((k) => k !== kind);
    const before = kinds;
    setKinds(next);
    try {
      await updateKinds(data.wedding.id, next);
      rememberDevice(me.user_id, next);
    } catch (e) { setKinds(before); fail(e); }
  };

  const test = async () => {
    setBusy(true);
    try { await sendTestPush(); toast(t('push.testSent')); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const message: Record<Exclude<typeof support, 'ok'>, string> = {
    mock: t('push.mockOnly'), notConfigured: t('push.notConfigured'), needsInstall: t('push.needsInstall'),
    needsNewerIos: t('push.needsNewerIos'), unsupported: t('push.unsupported'),
  };

  return (
    <section className="card stack" aria-labelledby="ntfH">
      <h3 id="ntfH">{t('push.title')}</h3>
      <p className="muted small">{t('push.intro')}</p>
      {support !== 'ok' ? (
        <p className="banner view" role="note">{message[support]}</p>
      ) : loading ? (
        <p className="muted small" role="status">{t('push.working')}</p>
      ) : (
        <>
          <label className="row switch-row">
            <input type="checkbox" role="switch" className="switch" checked={kinds !== null} disabled={busy}
              aria-checked={kinds !== null} onChange={(e) => void toggle(e.target.checked)} />
            <span>{t('push.toggle')}</span>
          </label>
          {blocked && kinds === null && <p className="banner view" role="note">{t('push.blocked')}</p>}
          {kinds !== null && (
            <>
              <fieldset className="stack" disabled={busy}>
                <legend className="label">{t('push.kindsLabel')}</legend>
                {NOTIFY_KINDS.map((k) => (
                  <label key={k} className="row" style={{ gap: 10 }}>
                    <input type="checkbox" className="check" checked={kinds.includes(k)} onChange={(e) => void setKind(k, e.target.checked)} />
                    <span>{t(`push.kinds.${k}`)}</span>
                  </label>
                ))}
              </fieldset>
              <div><button type="button" className="btn small" disabled={busy} onClick={() => void test()}>{t('push.test')}</button></div>
            </>
          )}
        </>
      )}
    </section>
  );
}
