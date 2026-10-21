import { describe, expect, it } from 'vitest';
import { buildMockData } from '../mock/mockData';
import type { BudgetCategory } from '../types';
import { budgetStatus, lockedTotal, plannedTotal, rebalance, scaleTotal, snapshot, type Amounts } from './budget';
import { sum } from './sum';

const setup = () => buildMockData();
const applied = (cats: BudgetCategory[], amounts: Amounts) =>
  cats.map((c) => (c.id in amounts ? { ...c, amount_usd: amounts[c.id] } : c));

describe('rebalance', () => {
  it('leaves a plan that already fits the total unchanged', () => {
    const d = setup();
    const r = rebalance(15000, d.budget_categories, d.events);
    expect(r.ok).toBe(true);
    if (r.ok) expect(applied(d.budget_categories, r.amounts)).toEqual(d.budget_categories);
  });

  it('scales unlocked categories to hit the new total exactly and keeps locked ones', () => {
    const d = setup();
    const r = rebalance(12000, d.budget_categories, d.events);
    if (!r.ok) throw new Error('expected ok');
    const cats = applied(d.budget_categories, r.amounts);
    expect(plannedTotal(cats, d.events)).toBe(12000);
    expect(cats.find((c) => c.key === 'florals')!.amount_usd).toBe(1800);
    expect(cats.find((c) => c.key === 'lighting')!.amount_usd).toBe(700);
    expect(Object.values(r.amounts).every((x) => x % 10 === 0)).toBe(true);
  });

  it('gives the rounding remainder to the largest unlocked category', () => {
    const d = setup();
    const r = rebalance(12345, d.budget_categories, d.events);
    if (!r.ok) throw new Error('expected ok');
    const odd = Object.entries(r.amounts).filter(([, x]) => x % 10 !== 0);
    expect(odd.map(([id]) => id)).toEqual(['c-catering']);
    expect(plannedTotal(applied(d.budget_categories, r.amounts), d.events)).toBe(12345);
  });

  it('only touches unlocked categories of events that are switched on', () => {
    const d = setup();
    const r = rebalance(10000, d.budget_categories, d.events);
    if (!r.ok) throw new Error('expected ok');
    const ids = Object.keys(r.amounts);
    expect(ids).not.toContain('c-rehearsal');
    expect(ids).not.toContain('c-dayafter');
    expect(ids).not.toContain('c-florals');
    expect(ids).toContain('c-welcome');
  });

  it('refuses when locked must-haves exceed the total', () => {
    const d = setup();
    expect(lockedTotal(d.budget_categories, d.events)).toBe(2500);
    expect(rebalance(2490, d.budget_categories, d.events)).toEqual({ ok: false, reason: 'lockedExceedTotal' });
    expect(rebalance(2500, d.budget_categories, d.events).ok).toBe(true);
  });

  it('refuses when everything is locked', () => {
    const d = setup();
    const cats = d.budget_categories.map((c) => ({ ...c, is_locked: true }));
    expect(rebalance(20000, cats, d.events)).toEqual({ ok: false, reason: 'nothingUnlocked' });
  });

  it('splits evenly when every unlocked category is at zero', () => {
    const d = setup();
    const cats = d.budget_categories.map((c) => (c.is_locked ? c : { ...c, amount_usd: 0 }));
    const r = rebalance(2500 + 1400, cats, d.events);
    if (!r.ok) throw new Error('expected ok');
    // 12 unlocked categories: $1,400 / 12 rounds to $120 each, and the first absorbs the −$40 remainder.
    const values = Object.values(r.amounts);
    expect(sum(values, (x) => x)).toBe(1400);
    expect(values.filter((x) => x !== 120)).toEqual([80]);
  });

  it('does not drift while dragging, because it always scales from the snapshot', () => {
    const d = setup();
    const base = snapshot(d.budget_categories, d.events);
    let cats = d.budget_categories;
    for (const total of [9000, 31000, 6250, 22000, 15000]) {
      const r = rebalance(total, cats, d.events, base);
      if (!r.ok) throw new Error('expected ok');
      cats = applied(cats, r.amounts);
      expect(plannedTotal(cats, d.events)).toBe(total);
    }
    expect(cats).toEqual(d.budget_categories);
  });

  it('drifts without a snapshot, which is why dragging uses one', () => {
    const d = setup();
    let cats = d.budget_categories;
    for (const total of [5150, 39870, 5150, 15000]) {
      const r = rebalance(total, cats, d.events);
      if (r.ok) cats = applied(cats, r.amounts);
    }
    expect(cats).not.toEqual(d.budget_categories);
  });
});

describe('budget status and chips', () => {
  it('matches within $5, otherwise says over or under by how much', () => {
    expect(budgetStatus(15000, 15004)).toEqual({ kind: 'ok' });
    expect(budgetStatus(15000, 15800)).toEqual({ kind: 'over', by: 800 });
    expect(budgetStatus(15000, 14000)).toEqual({ kind: 'under', by: 1000 });
  });

  it('rounds the quick chips to $50', () => {
    expect(scaleTotal(15000, -10)).toBe(13500);
    expect(scaleTotal(13333, 10)).toBe(14650);
  });
});
