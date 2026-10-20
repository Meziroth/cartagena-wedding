import { describe, expect, it } from 'vitest';
import { buildMockData } from '../mock/mockData';
import { activeCategories, paidTotal, plannedTotal } from './budget';
import { addDays, daysBetween, minusMonths } from './dates';
import { formatMoney, fromDisplay, toDisplay } from './money';
import { DEFAULT_TOTAL_USD, SEED_CATEGORIES, SEED_EVENTS, TASK_TEMPLATE } from './seedData';

describe('dates', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2027-12-31', '2028-01-22')).toBe(22);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('steps back whole months, then ~30 days per fraction (as the prototype does)', () => {
    expect(minusMonths('2028-01-22', 12)).toBe('2027-01-22');
    expect(minusMonths('2028-01-22', 0.25)).toBe('2028-01-14');
    expect(minusMonths('2028-01-22', 14.5)).toBe('2026-11-07');
  });
  it('clamps month steps to the last day of the month, like Postgres', () => {
    expect(minusMonths('2028-01-31', 2)).toBe('2027-11-30');
    expect(minusMonths('2028-02-29', 12)).toBe('2027-02-28');
  });
});

describe('money', () => {
  it('formats USD and es-CO grouped COP', () => {
    expect(formatMoney(15000, 'USD', 3194)).toBe('$15,000');
    expect(formatMoney(15000, 'COP', 3194)).toBe('COP 47.910.000');
    expect(formatMoney(15000, 'COP', 3194, true)).toBe('COP 47.9M');
  });
  it('round-trips through the display currency as whole USD', () => {
    expect(toDisplay(100, 'COP', 3194)).toBe(319400);
    expect(fromDisplay('319400', 'COP', 3194)).toBe(100);
    expect(fromDisplay('', 'USD', 3194)).toBe(0);
  });
});

describe('seed data', () => {
  it('has the 35-task template with the first three done', () => {
    expect(TASK_TEMPLATE).toHaveLength(35);
    expect(TASK_TEMPLATE.filter((t) => t[4]).map((t) => t[1])).toEqual(TASK_TEMPLATE.slice(0, 3).map((t) => t[1]));
  });
  it('totals $15,000 across the events that start switched on', () => {
    const on = new Set(SEED_EVENTS.filter((e) => e.is_on).map((e) => e.key));
    const total = SEED_CATEGORIES.filter(([, , , , ev]) => on.has(ev)).reduce((t, [, , amt]) => t + amt, 0);
    expect(total).toBe(DEFAULT_TOTAL_USD);
  });
  it('locks only florals and lighting', () => {
    expect(SEED_CATEGORIES.filter((c) => c[3]).map((c) => c[0])).toEqual(['florals', 'lighting']);
  });
});

describe('budget selectors', () => {
  it('only counts categories of active events', () => {
    const d = buildMockData();
    expect(plannedTotal(d.budget_categories, d.events)).toBe(15000);
    expect(activeCategories(d.budget_categories, d.events).some((c) => c.key === 'rehearsal')).toBe(false);
    const events = d.events.map((e) => (e.key === 'rehearsal' ? { ...e, is_on: true } : e));
    expect(plannedTotal(d.budget_categories, events)).toBe(15800);
  });
  it('sums paid payments for active categories only', () => {
    const d = buildMockData();
    const payments = d.payments.map((p) => ({ ...p, is_paid: true }));
    expect(paidTotal(payments, d.budget_categories, d.events)).toBe(1680);
    expect(paidTotal(d.payments, d.budget_categories, d.events)).toBe(0);
  });
});
