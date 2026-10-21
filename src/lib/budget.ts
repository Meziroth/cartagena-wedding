// Budget selectors and the flex rule, ported from reference/prototype.html.
// Only categories of events that are switched on count toward the plan.
import type { BudgetCategory, Payment, WeddingEvent } from '../types';
import { sum } from './sum';

export const activeEventIds = (events: readonly WeddingEvent[]): Set<string> =>
  new Set(events.filter((e) => e.is_on).map((e) => e.id));

export const activeCategories = (cats: readonly BudgetCategory[], events: readonly WeddingEvent[]): BudgetCategory[] => {
  const on = activeEventIds(events);
  return cats.filter((c) => on.has(c.event_id));
};

export const plannedTotal = (cats: readonly BudgetCategory[], events: readonly WeddingEvent[]): number =>
  sum(activeCategories(cats, events), (c) => c.amount_usd);

export const lockedTotal = (cats: readonly BudgetCategory[], events: readonly WeddingEvent[]): number =>
  sum(activeCategories(cats, events).filter((c) => c.is_locked), (c) => c.amount_usd);

export const paidForCategory = (payments: readonly Payment[], categoryId: string): number =>
  sum(payments.filter((p) => p.is_paid && p.category_id === categoryId), (p) => p.amount_usd);

/** Paid payments whose category belongs to an active event. */
export const paidTotal = (
  payments: readonly Payment[], cats: readonly BudgetCategory[], events: readonly WeddingEvent[],
): number => {
  const active = new Set(activeCategories(cats, events).map((c) => c.id));
  return sum(payments.filter((p) => p.is_paid && p.category_id !== null && active.has(p.category_id)), (p) => p.amount_usd);
};

/** Category id → whole USD. */
export type Amounts = Record<string, number>;

export type RebalanceResult =
  | { ok: true; amounts: Amounts }
  | { ok: false; reason: 'lockedExceedTotal' | 'nothingUnlocked' };

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * The flex rule. Locked categories keep their amount; the rest share `total − locked` in proportion to their
 * amounts in `base` (rounded to $10), and the rounding remainder goes to the largest unlocked category.
 * While a slider is dragged, pass the amounts from when the drag began as `base`, so repeated calls don't drift.
 * Returns the new amounts of the active unlocked categories only.
 */
export function rebalance(
  total: number, cats: readonly BudgetCategory[], events: readonly WeddingEvent[], base?: Amounts,
): RebalanceResult {
  const act = activeCategories(cats, events);
  const locked = act.filter((c) => c.is_locked);
  const free = act.filter((c) => !c.is_locked);
  const src = (c: BudgetCategory) => base?.[c.id] ?? c.amount_usd;
  const pool = total - sum(locked, (c) => c.amount_usd);
  if (pool < 0) return { ok: false, reason: 'lockedExceedTotal' };
  if (!free.length) return { ok: false, reason: 'nothingUnlocked' };

  const unlockedBase = sum(free, src);
  const next = free.map((c) => ({
    id: c.id,
    amount: unlockedBase <= 0 ? round10(pool / free.length) : Math.max(0, round10((src(c) * pool) / unlockedBase)),
  }));
  const remainder = pool - sum(next, (x) => x.amount);
  const biggest = next.reduce((a, b) => (b.amount > a.amount ? b : a), next[0]);
  biggest.amount += remainder;
  return { ok: true, amounts: Object.fromEntries(next.map((x) => [x.id, x.amount])) };
}

/** Current amounts of the active categories, e.g. as the snapshot when a drag begins. */
export const snapshot = (cats: readonly BudgetCategory[], events: readonly WeddingEvent[]): Amounts =>
  Object.fromEntries(activeCategories(cats, events).map((c) => [c.id, c.amount_usd]));

/** The quick chips: −20% … +20%, rounded to $50 as in the prototype. */
export const scaleTotal = (total: number, pct: number): number => Math.round((total * (1 + pct / 100)) / 50) * 50;

export const TOTAL_MIN = 5000;
export const TOTAL_MAX = 40000;
export const TOTAL_STEP = 250;

/** Within $5 counts as matching, as in the prototype. */
export type BudgetStatus = { kind: 'ok' } | { kind: 'over'; by: number } | { kind: 'under'; by: number };

export function budgetStatus(total: number, planned: number): BudgetStatus {
  const diff = total - planned;
  if (Math.abs(diff) <= 5) return { kind: 'ok' };
  return diff < 0 ? { kind: 'over', by: -diff } : { kind: 'under', by: diff };
}

export const bufferCategory = (cats: readonly BudgetCategory[]): BudgetCategory | undefined => cats.find((c) => c.is_buffer);
