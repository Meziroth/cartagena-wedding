// App shell: sidebar on desktop; top bar, bottom tab bar and a "More" sheet on phones.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, TileDefs } from '../components/Icon';
import { OfflineBanner } from '../components/OfflineBanner';
import { dataSource } from '../data/source';
import { setLang, type Lang } from '../i18n';
import { fmtD } from '../lib/dates';
import { resyncPush } from '../lib/push';
import es from '../locales/es.json';
import { useAuth } from '../state/auth';
import { useCurrency } from '../state/currency';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import type { Currency } from '../types';
import { ROUTES, TABS, type RouteId } from './routes';

// Spanish stays hidden until es.json has translations.
const SHOW_LANG = Object.keys(es).length > 0;

function Monogram({ short = false }: { short?: boolean }) {
  return short
    ? <>N <span className="amp">&amp;</span> T</>
    : <>Nick <span className="amp">&amp;</span> Thuraya</>;
}

function CurrencySwitch() {
  const { t } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="seg" role="group" aria-label={t('topbar.currency')}>
      {(['USD', 'COP'] as Currency[]).map((c) => (
        <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c}</button>
      ))}
    </div>
  );
}

function AccountMenu() {
  const { t, i18n } = useTranslation();
  const { me } = useWedding();
  const { signOut: endSession } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = () => {
    setOpen(false);
    if (dataSource.kind === 'mock') toast(t('topbar.signOutMock'));
    else void endSession();
  };

  return (
    <div className="account" ref={root}>
      <button ref={button} type="button" className="avatar" aria-expanded={open} aria-controls="accountMenu"
        aria-label={t('topbar.account', { name: me.display_name })} onClick={() => setOpen((o) => !o)}>
        {me.display_name.slice(0, 1).toUpperCase()}
      </button>
      <div className="menu" id="accountMenu" hidden={!open}>
        <div>
          <p className="label">{t('topbar.signedInAs')}</p>
          <p><b>{me.display_name}</b></p>
          <p className="muted" style={{ fontSize: '.85rem', overflowWrap: 'anywhere' }}>{me.email}</p>
          <p className="muted" style={{ fontSize: '.85rem' }}>{t(me.role === 'owner' ? 'topbar.roleOwner' : 'topbar.rolePlanner')}</p>
        </div>
        {SHOW_LANG && (
          <div className="field">
            <label htmlFor="langSel">{t('topbar.language')}</label>
            <select id="langSel" value={i18n.language} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        )}
        <button type="button" className="btn small" onClick={signOut}>{t('topbar.signOut')}</button>
      </div>
    </div>
  );
}

export function Shell() {
  const { t } = useTranslation();
  const { data, me } = useWedding();

  // Keep this device's notification subscription known to the server (browsers sometimes replace it).
  useEffect(() => { void resyncPush(data.wedding.id, me.user_id).catch(() => {}); }, [data.wedding.id, me.user_id]);
  const location = useLocation();
  const view = useRef<HTMLDivElement>(null);
  const lastPath = useRef(location.pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);

  const label = (id: RouteId) => t(`nav.${id}`);
  const current = ROUTES.find((r) => r.path === location.pathname)?.id;

  // On navigation: close the sheet, jump to the top and move focus to the new screen.
  useEffect(() => {
    setMoreOpen(false);
    // Only on a real route change (not the first render, which React may run twice in development).
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    window.scrollTo(0, 0);
    view.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!moreRef.current?.contains(el) && !moreBtn.current?.contains(el)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreOpen(false); moreBtn.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [moreOpen]);

  const w = data.wedding;
  const sideDate = t('app.sideDate', { date: fmtD(w.wedding_date, { month: 'long', day: 'numeric', year: 'numeric' }) })
    + (w.date_confirmed ? '' : t('app.targetSuffix'));
  const moreRoutes = ROUTES.filter((r) => !TABS.includes(r.id));

  return (
    <>
      <TileDefs />
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); view.current?.focus(); }}>{t('app.skip')}</a>
      <div className="app">
        <aside className="side" aria-label={t('app.plannerLabel')}>
          <div className="mono"><Monogram /><small>{sideDate}</small></div>
          <nav className="nav" aria-label={t('nav.sections')}>
            {ROUTES.map((r) => (
              <NavLink key={r.id} to={r.path} end><Icon name={r.icon} />{label(r.id)}</NavLink>
            ))}
          </nav>
          {dataSource.kind === 'mock' && <div className="side-foot"><p className="muted">{t('app.sideFootMock')}</p></div>}
        </aside>

        <main id="main">
          <div className="topbar">
            <div className="mono" aria-hidden="true"><Monogram short /></div>
            <CurrencySwitch />
            <AccountMenu />
          </div>
          <div className="wrap view" ref={view} tabIndex={-1}>
            <OfflineBanner />
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label={t('nav.sections')}>
        {TABS.map((id) => {
          const r = ROUTES.find((x) => x.id === id)!;
          return (
            <NavLink key={id} to={r.path} end>
              <Icon name={r.icon} size={22} />{id === 'inspiration' ? t('nav.inspirationShort') : label(id)}
            </NavLink>
          );
        })}
        <button ref={moreBtn} type="button" aria-expanded={moreOpen} aria-controls="moreSheet"
          aria-current={current && !TABS.includes(current) ? 'page' : undefined} onClick={() => setMoreOpen((o) => !o)}>
          <Icon name="more" size={22} />{t('nav.more')}
        </button>
      </nav>
      <div className="more-sheet" id="moreSheet" ref={moreRef} hidden={!moreOpen}>
        {moreRoutes.map((r) => (
          <NavLink key={r.id} to={r.path} end><Icon name={r.icon} />{label(r.id)}</NavLink>
        ))}
      </div>
    </>
  );
}
