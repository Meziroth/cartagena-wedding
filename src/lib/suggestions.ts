// Suggestions: plain rules over the wedding data (no AI), ported from the prototype's suggestions().
// A pure function, so it's easy to test; texts come from en.json through `t`.
import type { TFunction } from 'i18next';
import type { RouteId } from '../app/routes';
import type { Dataset } from '../mock/mockData';
import { bufferCategory, lockedTotal, plannedTotal } from './budget';
import { daysBetween, fmtD } from './dates';

export type SuggestionAction =
  | { kind: 'rebalance' }
  | { kind: 'toBuffer' }
  | { kind: 'buffer7' }
  | { kind: 'go'; route: RouteId }
  | { kind: 'task'; title: string }
  | { kind: 'note'; text: string };

export interface Suggestion {
  /** Stable id; dismissing stores it per wedding. Some include numbers so a changed situation shows again. */
  key: string;
  tone: 'alert' | 'warn' | 'tip';
  title: string;
  body: string;
  action?: SuggestionAction & { label: string };
}

export interface SuggestionContext {
  today: string;
  money: (usd: number) => string;
  t: TFunction;
  /** Owners can act on the budget; the planner sees budget suggestions without the buttons. */
  canBudget: boolean;
}

/** Every rule that applies, in the prototype's order, minus the ones this wedding dismissed. */
export function suggestions(d: Dataset, ctx: SuggestionContext): Suggestion[] {
  const { today, money, t, canBudget } = ctx;
  const out: Suggestion[] = [];
  const w = d.wedding;
  const total = w.total_budget_usd;
  const plan = plannedTotal(d.budget_categories, d.events);
  const locked = lockedTotal(d.budget_categories, d.events);
  const monthsLeft = daysBetween(today, w.wedding_date) / 30.4;
  const act = (a: SuggestionAction, label: string) => ({ ...a, label: t(label) });

  if (plan > total + 5) {
    out.push({ key: 'over', tone: 'alert', title: t('suggest.over.title', { amount: money(plan - total) }), body: t('suggest.over.body'),
      action: canBudget ? act({ kind: 'rebalance' }, 'budget.rebalanceToFit') : undefined });
  } else if (total - plan > 5) {
    out.push({ key: 'under', tone: 'tip', title: t('suggest.under.title', { amount: money(total - plan) }), body: t('suggest.under.body'),
      action: canBudget ? act({ kind: 'toBuffer' }, 'budget.addToBuffer') : undefined });
  }

  const buffer = bufferCategory(d.budget_categories);
  if (buffer && total > 0 && buffer.amount_usd / total < 0.05) {
    out.push({ key: 'buffer', tone: 'warn', title: t('suggest.buffer.title', { pct: Math.round((buffer.amount_usd / total) * 100) }),
      body: t('suggest.buffer.body', { amount: money(total * 0.07) }),
      action: canBudget ? act({ kind: 'buffer7' }, 'suggest.buffer.action') : undefined });
  }

  if (total > 0 && locked / total > 0.6) {
    out.push({ key: 'locked', tone: 'warn', title: t('suggest.locked.title', { pct: Math.round((locked / total) * 100) }), body: t('suggest.locked.body') });
  }

  for (const p of [...d.payments].filter((x) => !x.is_paid).sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    const days = daysBetween(today, p.due_date);
    if (days > 30) continue;
    out.push({
      key: `pay-${p.id}`, tone: days < 0 ? 'alert' : 'warn',
      title: t(days < 0 ? 'suggest.pay.wasDue' : 'suggest.pay.due', { label: p.label, amount: money(p.amount_usd), date: fmtD(p.due_date, { month: 'short', day: 'numeric' }) }),
      body: t('suggest.pay.body'), action: act({ kind: 'go', route: 'budget' }, 'suggest.openBudget'),
    });
  }

  const overdue = d.tasks.filter((x) => !x.is_done && x.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (overdue.length) {
    out.push({ key: `overdue-${overdue.length}`, tone: 'warn', title: t('suggest.overdue.title', { count: overdue.length }),
      body: overdue.slice(0, 3).map((x) => x.title).join(' · '), action: act({ kind: 'go', route: 'checklist' }, 'suggest.openChecklist') });
  }

  if (!w.date_confirmed) {
    out.push({ key: 'date', tone: 'tip', title: t('suggest.date.title'), body: t('suggest.date.body'),
      action: act({ kind: 'go', route: 'details' }, 'suggest.date.action') });
  }

  const venue = d.budget_categories.find((c) => c.key === 'venue');
  const venueBooked = !!venue && d.vendors.some((v) => v.category_id === venue.id && v.status >= 3);
  if (!venueBooked && monthsLeft <= 16) {
    out.push({ key: 'venue', tone: 'warn', title: t('suggest.venue.title'), body: t('suggest.venue.body'),
      action: act({ kind: 'go', route: 'vendors' }, 'suggest.openVendors') });
  }

  out.push({ key: 'legal', tone: 'tip', title: t('suggest.legal.title'), body: t('suggest.legal.body'),
    action: act({ kind: 'note', text: t('suggest.legal.note') }, 'suggest.addToNotes') });

  if (d.budget_categories.find((c) => c.key === 'florals')?.is_locked) {
    out.push({ key: 'flowers', tone: 'tip', title: t('suggest.flowers.title'), body: t('suggest.flowers.body') });
  }

  out.push({ key: 'iva', tone: 'tip', title: t('suggest.iva.title'), body: t('suggest.iva.body'),
    action: act({ kind: 'task', title: t('suggest.iva.task') }, 'suggest.addTask') });
  out.push({ key: 'sunset', tone: 'tip', title: t('suggest.sunset.title'), body: t('suggest.sunset.body') });
  out.push({ key: 'hora', tone: 'tip', title: t('suggest.hora.title'), body: t('suggest.hora.body') });

  const guests = w.guest_target;
  if (guests > 0) {
    out.push({ key: `pp-${guests}-${total}`, tone: 'tip', title: t('suggest.perGuest.title', { amount: money(total / guests), n: guests }),
      body: t('suggest.perGuest.body', { at30: money(total / 30), at50: money(total / 50) }) });
  }

  const dismissed = new Set(d.dismissed_suggestions.map((x) => x.suggestion_key));
  return out.filter((s) => !dismissed.has(s.key));
}

/** The ones the Budget screen shows, as in the prototype. */
export const isBudgetSuggestion = (s: Suggestion): boolean =>
  ['over', 'under', 'buffer', 'locked', 'iva', 'flowers'].includes(s.key) || s.key.startsWith('pay-') || s.key.startsWith('pp-');
