// Budget selectors. Only categories of events that are switched on count toward the plan.
// The flex rule (rebalance) lands here in Phase 4.
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

export const paidForCategory = (payments: readonly Payment[], categoryId: string): number =>
  sum(payments.filter((p) => p.is_paid && p.category_id === categoryId), (p) => p.amount_usd);

/** Paid payments whose category belongs to an active event. */
export const paidTotal = (
  payments: readonly Payment[], cats: readonly BudgetCategory[], events: readonly WeddingEvent[],
): number => {
  const active = new Set(activeCategories(cats, events).map((c) => c.id));
  return sum(payments.filter((p) => p.is_paid && p.category_id !== null && active.has(p.category_id)), (p) => p.amount_usd);
};
