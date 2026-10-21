import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { buildMockData, type Dataset } from '../mock/mockData';
import { plannedTotal, raiseBuffer } from './budget';
import { formatUSD } from './money';
import { isBudgetSuggestion, suggestions, type Suggestion } from './suggestions';

const ctx = { today: '2026-10-21', money: formatUSD, t: i18n.t, canBudget: true };
const keys = (list: Suggestion[]) => list.map((s) => s.key);
const withCats = (d: Dataset, f: (c: Dataset['budget_categories'][number]) => Partial<Dataset['budget_categories'][number]>) =>
  ({ ...d, budget_categories: d.budget_categories.map((c) => ({ ...c, ...f(c) })) });

describe('suggestions', () => {
  it('lists the standing tips for a fresh plan, in the prototype order', () => {
    const d = buildMockData();
    // Example data: plan fits, buffer is 2%, date not confirmed, venue not booked 15 months out.
    expect(keys(suggestions(d, ctx))).toEqual(['buffer', 'date', 'venue', 'legal', 'flowers', 'iva', 'sunset', 'hora', 'pp-40-15000']);
  });

  it('flags going over, with a rebalance only for owners', () => {
    const d = withCats(buildMockData(), (c) => (c.key === 'venue' ? { amount_usd: c.amount_usd + 1000 } : {}));
    const over = suggestions(d, ctx).find((s) => s.key === 'over')!;
    expect(over.tone).toBe('alert');
    expect(over.title).toBe('Your plan is $1,000 over budget');
    expect(over.action).toEqual({ kind: 'rebalance', label: 'Rebalance to fit' });
    expect(suggestions(d, { ...ctx, canBudget: false }).find((s) => s.key === 'over')!.action).toBeUndefined();
  });

  it('offers to add unassigned money to the buffer', () => {
    const d = withCats(buildMockData(), (c) => (c.key === 'venue' ? { amount_usd: c.amount_usd - 600 } : {}));
    const under = suggestions(d, ctx).find((s) => s.key === 'under')!;
    expect(under.title).toBe('$600 isn’t assigned to anything yet');
    expect(under.action?.kind).toBe('toBuffer');
  });

  it('warns when more than 60% is locked', () => {
    const d = withCats(buildMockData(), (c) => (['venue', 'catering', 'photo', 'planner'].includes(c.key ?? '') ? { is_locked: true } : {}));
    expect(suggestions(d, ctx).find((s) => s.key === 'locked')?.title).toBe('74% of the budget is locked') // 11,100 of 15,000;
  });

  it('flags payments due within 30 days, and overdue ones as alerts', () => {
    const d = buildMockData();
    const s = suggestions(d, { ...ctx, today: '2026-12-10' });
    const pays = s.filter((x) => x.key.startsWith('pay-'));
    expect(pays.map((x) => [x.key, x.tone])).toEqual([['pay-p-1', 'alert'], ['pay-p-2', 'warn']]);
    expect(pays[0].title).toBe('Planner retainer: $400 was due Nov 30');
  });

  it('counts overdue tasks and lists the first three', () => {
    const s = suggestions(buildMockData(), { ...ctx, today: '2027-01-10' }).find((x) => x.key.startsWith('overdue-'))!;
    expect(s.key).toBe('overdue-6');
    expect(s.title).toBe('6 tasks are past due');
    expect(s.body.split(' · ')).toHaveLength(3);
  });

  it('drops the venue tip once the venue is booked, and the date tip once confirmed', () => {
    const d = buildMockData();
    const booked = { ...d, vendors: d.vendors.map((v) => (v.id === 'v-1' ? { ...v, status: 3 } : v)), wedding: { ...d.wedding, date_confirmed: true } };
    expect(keys(suggestions(booked, ctx))).not.toContain('venue');
    expect(keys(suggestions(booked, ctx))).not.toContain('date');
  });

  it('only mentions flowers when florals are a must-have', () => {
    const d = withCats(buildMockData(), (c) => (c.key === 'florals' ? { is_locked: false } : {}));
    expect(keys(suggestions(d, ctx))).not.toContain('flowers');
  });

  it('hides dismissed suggestions; per-guest comes back when the numbers change', () => {
    const d = { ...buildMockData(), dismissed_suggestions: [{ wedding_id: 'w-mock', suggestion_key: 'hora' }, { wedding_id: 'w-mock', suggestion_key: 'pp-40-15000' }] };
    expect(keys(suggestions(d, ctx))).not.toContain('hora');
    expect(keys(suggestions(d, ctx))).not.toContain('pp-40-15000');
    expect(keys(suggestions({ ...d, wedding: { ...d.wedding, guest_target: 45 } }, ctx))).toContain('pp-45-15000');
  });

  it('carries the note and task actions with their text', () => {
    const s = suggestions(buildMockData(), ctx);
    expect(s.find((x) => x.key === 'legal')!.action).toMatchObject({ kind: 'note', text: expect.stringContaining('symbolic') });
    expect(s.find((x) => x.key === 'iva')!.action).toMatchObject({ kind: 'task', title: 'Confirm every vendor quote includes IVA' });
  });

  it('picks the budget ones for the Budget screen', () => {
    const s = suggestions(buildMockData(), { ...ctx, today: '2026-11-15' }).filter(isBudgetSuggestion);
    expect(keys(s)).toEqual(['buffer', 'pay-p-1', 'pay-p-2', 'flowers', 'iva', 'pp-40-15000']);
  });
});

describe('raise buffer to 7%', () => {
  it('sets the buffer and scales the other unlocked categories to keep the total', () => {
    const d = buildMockData();
    const r = raiseBuffer(15000, d.budget_categories, d.events, 0.07);
    if (!r.ok) throw new Error('expected ok');
    expect(r.amounts['c-buffer']).toBe(1050);
    const cats = d.budget_categories.map((c) => (c.id in r.amounts ? { ...c, amount_usd: r.amounts[c.id] } : c));
    expect(plannedTotal(cats, d.events)).toBe(15000);
    expect(cats.find((c) => c.key === 'florals')!.amount_usd).toBe(1800);
    expect(cats.find((c) => c.key === 'buffer')!.is_locked).toBe(false);
  });
});
