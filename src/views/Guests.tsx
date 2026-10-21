// Guests: who's on the list, RSVPs and travel. A table on desktop that turns into cards on phones.
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AddDisclosure, DeleteButton } from '../components/Controls';
import { Icon } from '../components/Icon';
import { insert, remove, update } from '../data/ops';
import { useChange } from '../data/useChange';
import { newId } from '../lib/ids';
import { sum } from '../lib/sum';
import { useMoney } from '../state/money';
import { useWedding } from '../state/wedding';
import type { Guest, Rsvp, Side, Travel } from '../types';

const RSVPS: Rsvp[] = ['Pending', 'Yes', 'Maybe', 'No'];
const TRAVEL: Travel[] = ['Not yet', 'Flights booked', 'Flights + hotel'];
const SIDES: Side[] = ['Nick', 'Thuraya', 'Both'];
/** Above this the prototype warns about catering cost. */
const GUEST_WARN = 50;

export function Guests() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const money = useMoney();
  const w = data.wedding;
  const g = data.guests;
  const people = sum(g, (x) => x.party_size);
  const count = (r: Rsvp) => sum(g.filter((x) => x.rsvp === r), (x) => x.party_size);
  const travel = sum(g.filter((x) => x.travel !== 'Not yet'), (x) => x.party_size);
  const catering = data.budget_categories.find((c) => c.key === 'catering');

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.guests.title')}</h2><p className="muted">{t('sections.guests.intro', { n: w.guest_target })}</p></div>
      </div>
      <div className="grid g3">
        <div className="card stat"><p className="label">{t('guests.onList')}</p><b className="num">{people}</b>
          <p className="muted small">{t('guests.target', { n: w.guest_target })}</p></div>
        <div className="card stat"><p className="label">{t('guests.rsvps')}</p><b className="num">{t('guests.yes', { n: count('Yes') })}</b>
          <p className="muted num small">{t('guests.rsvpBreakdown', { maybe: count('Maybe'), no: count('No'), pending: count('Pending') })}</p></div>
        <div className="card stat"><p className="label">{t('guests.travelBooked')}</p><b className="num">{travel}</b>
          <p className="muted small">{t('guests.ofPeople', { n: people })}</p></div>
      </div>
      {people > GUEST_WARN && (
        <div className="banner view" role="note"><Icon name="warn" size={18} />
          <span>{t('guests.overWarn', { n: GUEST_WARN, amount: money(catering && w.guest_target ? catering.amount_usd / w.guest_target : 0) })}</span>
        </div>
      )}
      <section className="card" aria-labelledby="glH">
        <h3 id="glH" className="sr">{t('guests.list')}</h3>
        <AddGuest />
        {g.length > 0 && (
          <div className="scroll" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead><tr>
                <th>{t('guests.name')}</th><th>{t('guests.people')}</th><th>{t('guests.side')}</th>
                <th>{t('guests.rsvp')}</th><th>{t('guests.travel')}</th><th><span className="sr">{t('common.delete')}</span></th>
              </tr></thead>
              <tbody>{g.map((x) => <GuestRow key={x.id} x={x} />)}</tbody>
            </table>
          </div>
        )}
        {!g.length && <div className="empty" style={{ marginTop: 12 }}>{t('guests.none')}</div>}
      </section>
    </>
  );
}

function GuestRow({ x }: { x: Guest }) {
  const { t } = useTranslation();
  const save = useChange();
  return (
    <tr>
      <td className="g-name">{x.name}</td>
      <td className="num">{t('guests.partySize', { count: x.party_size })}</td>
      <td>{t(`guests.sides.${x.side}`)}</td>
      <td>
        <label className="sr" htmlFor={`rs-${x.id}`}>{t('guests.rsvpFor', { name: x.name })}</label>
        <select id={`rs-${x.id}`} value={x.rsvp} onChange={(e) => save(update('guests', x.id, { rsvp: e.target.value as Rsvp }))}>
          {RSVPS.map((r) => <option key={r} value={r}>{t(`guests.rsvps_.${r}`)}</option>)}
        </select>
      </td>
      <td>
        <label className="sr" htmlFor={`tr-${x.id}`}>{t('guests.travelFor', { name: x.name })}</label>
        <select id={`tr-${x.id}`} value={x.travel} onChange={(e) => save(update('guests', x.id, { travel: e.target.value as Travel }))}>
          {TRAVEL.map((r) => <option key={r} value={r}>{t(`guests.travel_.${r}`)}</option>)}
        </select>
      </td>
      <td className="g-del">
        <DeleteButton label={t('guests.deleteLabel', { name: x.name })} onConfirm={() => save(remove('guests', x.id), t('guests.deleted'))} />
      </td>
    </tr>
  );
}

function AddGuest() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const save = useChange();

  const submit = (e: FormEvent<HTMLFormElement>, close: () => void) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(insert('guests', {
      id: newId(), wedding_id: data.wedding.id, name: String(f.get('name')).trim(),
      party_size: Math.min(50, Math.max(1, Number(f.get('party')) || 1)), side: String(f.get('side')) as Side,
      rsvp: 'Pending', travel: 'Not yet', notes: '',
    }), t('guests.added'));
    e.currentTarget.reset();
    close();
  };

  return (
    <AddDisclosure label={t('guests.add')} primary>
      {(close) => (
        <form className="formgrid" onSubmit={(e) => submit(e, close)}>
          <div className="field"><label htmlFor="ngName">{t('guests.nameOrParty')}</label>
            <input type="text" id="ngName" name="name" required maxLength={200} /></div>
          <div className="field"><label htmlFor="ngParty">{t('guests.people')}</label>
            <input type="number" id="ngParty" name="party" min={1} max={50} defaultValue={1} /></div>
          <div className="field"><label htmlFor="ngSide">{t('guests.side')}</label>
            <select id="ngSide" name="side">{SIDES.map((s) => <option key={s} value={s}>{t(`guests.sides.${s}`)}</option>)}</select></div>
          <button className="btn primary">{t('common.add')}</button>
        </form>
      )}
    </AddDisclosure>
  );
}
