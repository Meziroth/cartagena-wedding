// Wedding details: date, size, exchange rate and events (owners), people & access, and sign out.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewOnlyBanner } from '../components/Controls';
import { ExportButton } from '../components/Exports';
import { update } from '../data/ops';
import { useChange } from '../data/useChange';
import { fmtD } from '../lib/dates';
import { DATE_MAX, DATE_MIN } from '../lib/seedData';
import { USE_MOCK } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import { Members } from './Members';
import { Notifications } from './Notifications';

const GUESTS_MIN = 20;
const GUESTS_MAX = 80;
const RATE_MIN = 1000;
const RATE_MAX = 10000;

export function Details() {
  const { t } = useTranslation();
  const { data, isOwner } = useWedding();
  const save = useChange();
  const toast = useToast();
  const { signOut } = useAuth();
  const w = data.wedding;

  // The slider shows its value while dragged and saves on release.
  const [guests, setGuests] = useState(w.guest_target);
  useEffect(() => setGuests(w.guest_target), [w.guest_target]);
  const commitGuests = () => {
    if (guests !== w.guest_target) save({ type: 'updateWedding', weddingId: w.id, patch: { guest_target: guests } });
  };

  const [rate, setRate] = useState(String(w.fx_cop_per_usd));
  useEffect(() => setRate(String(w.fx_cop_per_usd)), [w.fx_cop_per_usd]);
  const commitRate = () => {
    const v = Number(rate);
    if (!(v >= RATE_MIN && v <= RATE_MAX)) {
      toast(t('details.rateRange', { min: RATE_MIN, max: RATE_MAX }));
      return setRate(String(w.fx_cop_per_usd));
    }
    if (v !== w.fx_cop_per_usd) save({ type: 'updateWedding', weddingId: w.id, patch: { fx_cop_per_usd: v } }, t('details.rateSaved'));
  };

  const setDate = (date: string) => {
    if (!date || date === w.wedding_date) return;
    if (date < DATE_MIN || date > DATE_MAX) return toast(t('details.dateRange', { min: fmtD(DATE_MIN), max: fmtD(DATE_MAX) }));
    save({ type: 'setWeddingDate', weddingId: w.id, date }, t('details.dateSaved', { date: fmtD(date) }));
  };

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.details.title')}</h2><p className="muted">{t('sections.details.intro')}</p></div>
      </div>
      {!isOwner && <ViewOnlyBanner>{t('details.viewOnly')}</ViewOnlyBanner>}
      <div className="grid g2">
        <section className="card stack" aria-labelledby="dH">
          <h3 id="dH">{t('details.dateSize')}</h3>
          <fieldset disabled={!isOwner} className="stack">
            <div className="field">
              <label htmlFor="dDate">{t('details.date')}</label>
              {/* key: reset the field if a save is rolled back */}
              <input key={w.wedding_date} type="date" id="dDate" min={DATE_MIN} max={DATE_MAX} defaultValue={w.wedding_date}
                aria-describedby="dDateHint" onBlur={(e) => setDate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setDate(e.currentTarget.value); }} />
              <span id="dDateHint" className="muted small">{t('details.dateHint', { min: fmtD(DATE_MIN), max: fmtD(DATE_MAX) })}</span>
            </div>
            <label className="row" style={{ gap: 10 }}>
              <input type="checkbox" className="check" checked={w.date_confirmed}
                onChange={(e) => save({ type: 'updateWedding', weddingId: w.id, patch: { date_confirmed: e.target.checked } })} />
              <span>{t('details.confirmed')}</span>
            </label>
            <div className="field">
              <label htmlFor="dGuests">{t('details.guests')} <b className="num">{guests}</b></label>
              <input type="range" id="dGuests" min={GUESTS_MIN} max={GUESTS_MAX} value={guests}
                aria-describedby="dGuestsHint" onChange={(e) => setGuests(Number(e.target.value))}
                onPointerUp={commitGuests} onKeyUp={commitGuests} onBlur={commitGuests} />
              <span id="dGuestsHint" className="muted small">{t('details.guestsHint')}</span>
            </div>
          </fieldset>
        </section>

        <section className="card stack" aria-labelledby="cH">
          <h3 id="cH">{t('details.currency')}</h3>
          <p className="muted small">{t('details.currencyIntro')}</p>
          <div className="field">
            <label htmlFor="dRate">{t('details.rate')}</label>
            <input type="number" id="dRate" min={RATE_MIN} max={RATE_MAX} step={1} value={rate} disabled={!isOwner}
              onChange={(e) => setRate(e.target.value)} onBlur={commitRate}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRate(); }} />
          </div>
          <p className="muted small">{t('details.rateNote')}</p>
        </section>

        <section className="card stack" aria-labelledby="eH">
          <h3 id="eH">{t('details.events')}</h3>
          <fieldset disabled={!isOwner} className="stack">
            <legend className="sr">{t('details.events')}</legend>
            {data.events.map((e) => (
              <label key={e.id} className="row" style={{ gap: 10 }}>
                <input type="checkbox" className="check" checked={e.is_on} disabled={e.is_fixed}
                  onChange={(ev) => save(update('events', e.id, { is_on: ev.target.checked }))} />
                <span>{e.name}{e.is_fixed && <span className="muted"> {t('details.alwaysOn')}</span>}</span>
              </label>
            ))}
          </fieldset>
          <p className="muted small">{t('details.eventsNote')}</p>
        </section>

        <Members />

        <Notifications />

        <section className="card stack" aria-labelledby="xH">
          <h3 id="xH">{t('exports.title')}</h3>
          <div className="row">
            <ExportButton kind="json" />
            <ExportButton kind="todoist" />
            <ExportButton kind="ics" />
            <ExportButton kind="budgetCsv" />
          </div>
          <p className="muted small">{t('exports.note')}</p>
          <p className="muted small">{t('exports.backupNote')}</p>
          {/* TODO(later): two-way Todoist sync. The personal API token would be stored encrypted and used only by an
              Edge Function, never in the browser. */}
          <div className="row">
            <button type="button" className="btn small" disabled aria-describedby="todoistSoon">{t('exports.todoistSync')}</button>
            <span id="todoistSoon" className="muted small">{t('exports.todoistSyncSoon')}</span>
          </div>
        </section>

        <section className="card stack" aria-labelledby="aH">
          <h3 id="aH">{t('details.account')}</h3>
          <p className="muted small">{USE_MOCK ? t('topbar.signOutMock') : t('details.signOutNote')}</p>
          {!USE_MOCK && <div><button type="button" className="btn small" onClick={() => void signOut()}>{t('topbar.signOut')}</button></div>}
        </section>
      </div>
    </>
  );
}
