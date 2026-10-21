// Budget: the total, the flex rule, categories by event, and payments. Owners edit; the planner views.
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AddDisclosure, DeleteButton, MoneyInput, ViewOnlyBanner } from '../components/Controls';
import { Icon } from '../components/Icon';
import { insert, remove, update } from '../data/ops';
import { useChange } from '../data/useChange';
import {
  activeCategories, budgetStatus, bufferCategory, lockedTotal, paidForCategory, paidTotal, plannedTotal, rebalance,
  scaleTotal, snapshot, TOTAL_MAX, TOTAL_MIN, TOTAL_STEP, type Amounts,
} from '../lib/budget';
import { fmtD, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { formatCOPNumber, fromDisplay, inputStep } from '../lib/money';
import { useCurrency } from '../state/currency';
import { useMoney } from '../state/money';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import type { BudgetCategory, Payment } from '../types';

const CHIPS = [-20, -10, 10, 20];

export function Budget() {
  const { t } = useTranslation();
  const { data, isOwner } = useWedding();
  const money = useMoney();
  const save = useChange();
  const toast = useToast();
  const w = data.wedding;
  const { events } = data;

  // While the slider is dragged, numbers update locally from a snapshot; the result is saved on release.
  const [draft, setDraft] = useState<{ total: number; amounts: Amounts } | null>(null);
  const dragBase = useRef<Amounts | null>(null);

  const cats = draft
    ? data.budget_categories.map((c) => (c.id in draft.amounts ? { ...c, amount_usd: draft.amounts[c.id] } : c))
    : data.budget_categories;
  const total = draft?.total ?? w.total_budget_usd;
  const act = activeCategories(cats, events);
  const plan = plannedTotal(cats, events);
  const paid = paidTotal(data.payments, cats, events);
  const locked = lockedTotal(cats, events);
  const status = budgetStatus(total, plan);
  const perGuest = w.guest_target ? total / w.guest_target : 0;

  const refuse = (reason: 'lockedExceedTotal' | 'nothingUnlocked') => toast(t(`budget.refuse.${reason}`));

  const setTotal = (next: number) => {
    const r = rebalance(next, data.budget_categories, events);
    if (!r.ok) return refuse(r.reason);
    save({ type: 'saveBudget', weddingId: w.id, total: next, amounts: r.amounts }, t('budget.totalNow', { total: money(next) }));
  };

  const drag = (next: number) => {
    dragBase.current ??= snapshot(data.budget_categories, events);
    const r = rebalance(next, data.budget_categories, events, dragBase.current);
    if (r.ok) setDraft({ total: next, amounts: r.amounts });
  };
  const endDrag = () => {
    dragBase.current = null;
    if (!draft) return;
    save({ type: 'saveBudget', weddingId: w.id, total: draft.total, amounts: draft.amounts });
    setDraft(null);
  };

  const rebalanceNow = () => {
    const r = rebalance(w.total_budget_usd, data.budget_categories, events);
    if (!r.ok) return refuse(r.reason);
    save({ type: 'saveBudget', weddingId: w.id, total: null, amounts: r.amounts }, t('budget.rebalanced'));
  };
  const addToBuffer = () => {
    const buffer = bufferCategory(data.budget_categories);
    if (!buffer || status.kind !== 'under') return;
    save(update('budget_categories', buffer.id, { amount_usd: buffer.amount_usd + status.by }), t('budget.addedToBuffer'));
  };

  const activeEvents = events.filter((e) => e.is_on);
  const byEvent = activeEvents.map((e) => ({ e, cats: cats.filter((c) => c.event_id === e.id) }));

  return (
    <>
      <div className="sec-head">
        <div><h2>{t('sections.budget.title')}</h2><p className="muted">{t('sections.budget.intro')}</p></div>
      </div>
      {!isOwner && <ViewOnlyBanner>{t('budget.viewOnly')}</ViewOnlyBanner>}

      <div className="grid g2">
        <section className="card flex-ctl" aria-labelledby="totH">
          <fieldset disabled={!isOwner} className="flex-ctl">
            <div>
              <p className="label" id="totH">{t('budget.total')}</p>
              <div className="total-big num">{money(total)}</div>
              <p className="muted num" style={{ marginTop: 6 }}>{t('budget.perGuest', { amount: money(perGuest), n: w.guest_target })}</p>
            </div>
            <div className="field">
              <label htmlFor="totRange">{t('budget.adjust')}</label>
              <input type="range" id="totRange" min={TOTAL_MIN} max={TOTAL_MAX} step={TOTAL_STEP}
                value={Math.min(TOTAL_MAX, Math.max(TOTAL_MIN, total))} aria-valuetext={money(total)}
                onChange={(e) => drag(Number(e.target.value))}
                onPointerUp={endDrag} onKeyUp={endDrag} onBlur={endDrag} />
            </div>
            <div className="row">
              {CHIPS.map((p) => (
                <button key={p} type="button" className="chip" onClick={() => setTotal(scaleTotal(w.total_budget_usd, p))}>
                  {p > 0 ? '+' : '−'}{Math.abs(p)}%
                </button>
              ))}
              <span className="field" style={{ flex: 1, minWidth: 140 }}>
                <MoneyInput id="totNum" usd={total} label={t('budget.exactTotal')} labelHidden
                  onCommit={(v) => v !== null && setTotal(v)} />
              </span>
            </div>
          </fieldset>
          <p className="muted small">{t('budget.lockedSummary', { locked: money(locked), count: act.filter((c) => c.is_locked).length, flex: money(total - locked) })}</p>
        </section>

        <section className="card stack" aria-labelledby="sumH">
          <h3 id="sumH" className="sr">{t('budget.summary')}</h3>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Figure label={t('budget.planned')} value={money(plan)} />
            <Figure label={t('budget.paidSoFar')} value={money(paid)} />
            <Figure label={t('budget.stillToPay')} value={money(plan - paid)} />
            <div>
              <p className="label">{t('budget.rate')}</p>
              <b className="num" style={{ fontSize: '1.4rem' }}>{formatCOPNumber(w.fx_cop_per_usd)}</b>
              <span className="muted" style={{ fontSize: '.8rem' }}> {t('budget.copPerUsd')}</span>
            </div>
          </div>
          <div className={`status-line ${status.kind === 'ok' ? 'ok' : status.kind === 'over' ? 'over' : ''}`} role="status" aria-live="polite">
            {status.kind === 'ok' && <><Icon name="spark" size={18} />{t('budget.status.ok')}</>}
            {status.kind === 'over' && (
              <>
                <Icon name="warn" size={18} />{t('budget.status.over', { amount: money(status.by) })}
                {isOwner && <button type="button" className="btn small" onClick={rebalanceNow}>{t('budget.rebalanceToFit')}</button>}
              </>
            )}
            {status.kind === 'under' && (
              <>
                {t('budget.status.under', { amount: money(status.by) })}
                {isOwner && <>
                  <button type="button" className="btn small" onClick={addToBuffer}>{t('budget.addToBuffer')}</button>
                  <button type="button" className="btn small ghost" onClick={rebalanceNow}>{t('budget.spreadOut')}</button>
                </>}
              </>
            )}
          </div>
          <div className="field">
            <p className="label" id="evH">{t('budget.events')}</p>
            <div className="chips" role="group" aria-labelledby="evH">
              {events.map((e) => (
                <button key={e.id} type="button" className="chip" aria-pressed={e.is_on} disabled={e.is_fixed || !isOwner}
                  onClick={() => save(update('events', e.id, { is_on: !e.is_on }), t(e.is_on ? 'budget.eventOff' : 'budget.eventOn', { name: e.name }))}>
                  {!e.is_on && <Icon name="plus" size={14} />}{e.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="catH">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 id="catH">{t('budget.categories')}</h3>
          <span className="muted small"><Icon name="lock" size={14} /> {t('budget.lockLegend')}</span>
        </div>
        {byEvent.map(({ e, cats: list }) => (
          <div key={e.id}>
            {byEvent.length > 1 && <p className="label" style={{ marginTop: 18 }}>{e.name}</p>}
            {list.map((c) => <CategoryRow key={c.id} c={c} total={total} paid={paidForCategory(data.payments, c.id)} />)}
          </div>
        ))}
        {isOwner && <AddCategory />}
      </section>

      <Payments categories={act} />
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return <div><p className="label">{label}</p><b className="num" style={{ fontSize: '1.4rem' }}>{value}</b></div>;
}

function CategoryRow({ c, total, paid }: { c: BudgetCategory; total: number; paid: number }) {
  const { t } = useTranslation();
  const { isOwner } = useWedding();
  const money = useMoney();
  const save = useChange();
  return (
    <div className="cat">
      <button type="button" className="icon-btn lock" aria-pressed={c.is_locked} disabled={!isOwner}
        aria-label={t(c.is_locked ? 'budget.unlock' : 'budget.lock', { name: c.name })}
        onClick={() => save(update('budget_categories', c.id, { is_locked: !c.is_locked }))}>
        <Icon name={c.is_locked ? 'lock' : 'unlock'} size={18} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div className="nm">{c.name}</div>
        <div className="sub">
          <span className="num">{total ? ((c.amount_usd / total) * 100).toFixed(1) : '0.0'}%</span>
          {paid > 0 && <span className="num" style={{ color: 'var(--sage)' }}>{t('budget.paidAmount', { amount: money(paid) })}</span>}
          {c.is_locked && <span style={{ color: 'var(--bougain)' }}>{t('budget.mustHave')}</span>}
        </div>
      </div>
      <div className="amt">
        <MoneyInput usd={c.amount_usd} disabled={!isOwner} labelHidden label={t('budget.amountOf', { name: c.name })}
          onCommit={(v) => save(update('budget_categories', c.id, { amount_usd: v ?? 0 }))} />
      </div>
      <DeleteButton label={t('budget.removeCategory', { name: c.name })} disabled={!isOwner || c.is_buffer}
        question={t('budget.removeCategoryQ')}
        onConfirm={() => save(remove('budget_categories', c.id), t('budget.categoryRemoved'))} />
      <div className="bar" aria-hidden="true">
        <i className="paid" style={{ width: `${c.amount_usd ? Math.min(100, (paid / c.amount_usd) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

function AddCategory() {
  const { t } = useTranslation();
  const { data } = useWedding();
  const { currency } = useCurrency();
  const save = useChange();
  const active = data.events.filter((e) => e.is_on);

  const submit = (e: FormEvent<HTMLFormElement>, close: () => void) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(insert('budget_categories', {
      id: newId(), wedding_id: data.wedding.id, event_id: String(f.get('event')), key: null,
      name: String(f.get('name')).trim(), amount_usd: Math.max(0, fromDisplay(String(f.get('amount')), currency, data.wedding.fx_cop_per_usd)),
      is_locked: false, is_buffer: false, sort: Math.max(0, ...data.budget_categories.map((c) => c.sort)) + 1,
    }), t('budget.categoryAdded'));
    e.currentTarget.reset();
    close();
  };

  return (
    <AddDisclosure label={t('budget.addCategory')} className="mt">
      {(close) => (
        <form className="formgrid" onSubmit={(e) => submit(e, close)}>
          <div className="field"><label htmlFor="ncName">{t('budget.name')}</label>
            <input type="text" id="ncName" name="name" required maxLength={200} placeholder={t('budget.namePlaceholder')} /></div>
          <div className="field"><label htmlFor="ncAmt">{t('budget.amountIn', { currency })}</label>
            <input type="number" id="ncAmt" name="amount" min={0} step={inputStep(currency)} required /></div>
          <div className="field"><label htmlFor="ncEv">{t('budget.event')}</label>
            <select id="ncEv" name="event">{active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <button className="btn primary">{t('common.add')}</button>
        </form>
      )}
    </AddDisclosure>
  );
}

function Payments({ categories }: { categories: BudgetCategory[] }) {
  const { t } = useTranslation();
  const { data, isOwner } = useWedding();
  const { currency } = useCurrency();
  const save = useChange();
  const list = [...data.payments].sort((a, b) => a.due_date.localeCompare(b.due_date));

  const submit = (e: FormEvent<HTMLFormElement>, close: () => void) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(insert('payments', {
      id: newId(), wedding_id: data.wedding.id, category_id: String(f.get('cat')) || null, label: String(f.get('label')).trim(),
      amount_usd: Math.max(0, fromDisplay(String(f.get('amount')), currency, data.wedding.fx_cop_per_usd)),
      due_date: String(f.get('due')), is_paid: false, paid_at: null,
    }), t('budget.paymentAdded'));
    e.currentTarget.reset();
    close();
  };

  return (
    <section className="card" aria-labelledby="payH">
      <div className="row between" style={{ marginBottom: 8 }}><h3 id="payH">{t('budget.payments')}</h3></div>
      <div style={{ marginTop: 8 }}>
        {list.length
          ? list.map((p) => <PaymentRow key={p.id} p={p} />)
          : <div className="empty">{t('budget.noPayments')}</div>}
      </div>
      {isOwner && (
        <AddDisclosure label={t('budget.addPayment')} className="mt">
          {(close) => (
            <form className="formgrid" onSubmit={(e) => submit(e, close)}>
              <div className="field"><label htmlFor="npLabel">{t('budget.what')}</label>
                <input type="text" id="npLabel" name="label" required maxLength={200} placeholder={t('budget.whatPlaceholder')} /></div>
              <div className="field"><label htmlFor="npAmt">{t('budget.amountIn', { currency })}</label>
                <input type="number" id="npAmt" name="amount" min={0} step={inputStep(currency)} required /></div>
              <div className="field"><label htmlFor="npDue">{t('budget.dueDate')}</label>
                <input type="date" id="npDue" name="due" required /></div>
              <div className="field"><label htmlFor="npCat">{t('budget.category')}</label>
                <select id="npCat" name="cat">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <button className="btn primary">{t('common.add')}</button>
            </form>
          )}
        </AddDisclosure>
      )}
    </section>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const { t } = useTranslation();
  const { data, isOwner } = useWedding();
  const money = useMoney();
  const save = useChange();
  const late = !p.is_paid && p.due_date < todayISO();
  const cat = data.budget_categories.find((c) => c.id === p.category_id);
  const id = `py-${p.id}`;
  return (
    <div className="pay">
      <input type="checkbox" className="check" id={id} checked={p.is_paid} disabled={!isOwner}
        aria-label={t('budget.paidLabel', { label: p.label })}
        onChange={(e) => save(update('payments', p.id, { is_paid: e.target.checked, paid_at: e.target.checked ? new Date().toISOString() : null }))} />
      <div style={{ minWidth: 0 }}>
        <label htmlFor={id}><b>{p.label}</b></label>
        <div className="t-meta">
          <span style={late ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>
            {late && t('budget.overdue')}{t(p.is_paid ? 'budget.paidOn' : 'budget.dueOn', { date: fmtD(p.due_date) })}
          </span>
          {cat && <span>{cat.name}</span>}
        </div>
      </div>
      <b className="num">{money(p.amount_usd)}</b>
      <DeleteButton label={t('budget.deletePayment', { label: p.label })} disabled={!isOwner}
        onConfirm={() => save(remove('payments', p.id), t('budget.paymentDeleted'))} />
    </div>
  );
}
