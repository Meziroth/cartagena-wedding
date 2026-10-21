import { describe, expect, it } from 'vitest';
import { filterTasks, groupByMonth, monthsOut } from '../lib/checklist';
import { notifyEventFor } from '../lib/notifyEvents';
import { buildMockData } from '../mock/mockData';
import { applyOp, insert, remove, update } from './ops';

describe('applyOp', () => {
  it('inserts, updates and deletes rows without mutating the original', () => {
    const d = buildMockData();
    const added = applyOp(d, insert('guests', {
      id: 'g-new', wedding_id: d.wedding.id, name: 'Ana', party_size: 2, side: 'Both', rsvp: 'Pending', travel: 'Not yet', notes: '',
    }));
    expect(added.guests).toHaveLength(d.guests.length + 1);
    expect(d.guests).toHaveLength(4);

    const changed = applyOp(added, update('guests', 'g-new', { rsvp: 'Yes' }));
    expect(changed.guests.find((g) => g.id === 'g-new')!.rsvp).toBe('Yes');
    expect(added.guests.find((g) => g.id === 'g-new')!.rsvp).toBe('Pending');

    expect(applyOp(changed, remove('guests', 'g-new')).guests).toHaveLength(4);
  });

  it('saves a total and category amounts together', () => {
    const d = buildMockData();
    const next = applyOp(d, { type: 'saveBudget', weddingId: d.wedding.id, total: 14000, amounts: { 'c-venue': 2400 } });
    expect(next.wedding.total_budget_usd).toBe(14000);
    expect(next.budget_categories.find((c) => c.id === 'c-venue')!.amount_usd).toBe(2400);
    expect(applyOp(d, { type: 'saveBudget', weddingId: d.wedding.id, total: null, amounts: {} }).wedding.total_budget_usd).toBe(15000);
  });

  it('moves every task by the same number of days when the date changes', () => {
    const d = buildMockData();
    const next = applyOp(d, { type: 'setWeddingDate', weddingId: d.wedding.id, date: '2028-02-12' });
    expect(next.wedding.wedding_date).toBe('2028-02-12');
    expect(next.tasks[0].due_date).toBe('2026-11-12'); // was 2026-10-22, +21 days
    expect(next.tasks.every((x, i) => x.due_date > d.tasks[i].due_date)).toBe(true);
  });
});

describe('checklist', () => {
  it('filters by person, counting "Both" for Nick and Thuraya only', () => {
    const tasks = buildMockData().tasks;
    const both = tasks.filter((x) => x.assignee === 'Both').length;
    expect(filterTasks(tasks, 'Nick')).toHaveLength(tasks.filter((x) => x.assignee === 'Nick').length + both);
    expect(filterTasks(tasks, 'Planner').every((x) => x.assignee === 'Planner')).toBe(true);
    expect(filterTasks(tasks, 'Done')).toHaveLength(3);
    expect(filterTasks(tasks, 'Open')).toHaveLength(32);
  });

  it('groups by due month in date order and labels months out', () => {
    const groups = groupByMonth(filterTasks(buildMockData().tasks, 'All'));
    expect(groups[0][0]).toBe('2026-10');
    expect(groups.map(([m]) => m)).toEqual([...groups.map(([m]) => m)].sort());
    expect(monthsOut('2027-01', '2028-01-22')).toBe(12);
    expect(monthsOut('2028-01', '2028-01-22')).toBe(0);
  });
});

describe('notifications', () => {
  it('notifies for new and edited notes, new ideas and ticked tasks only', () => {
    const d = buildMockData();
    const n = d.notes[0];
    expect(notifyEventFor(insert('notes', { ...n, id: 'n-new' }))).toEqual({ kind: 'note_created', id: 'n-new' });
    expect(notifyEventFor(update('notes', n.id, { body: 'x' }))).toEqual({ kind: 'note_edited', id: n.id });
    expect(notifyEventFor(update('notes', n.id, { tags: ['venue'] }))).toEqual({ kind: 'note_edited', id: n.id });
    expect(notifyEventFor(update('tasks', 't-1', { is_done: true }))).toEqual({ kind: 'task_done', id: 't-1' });
    expect(notifyEventFor(update('tasks', 't-1', { is_done: false }))).toBeNull();
    expect(notifyEventFor(insert('ideas', { ...d.ideas[0], id: 'i-new' }))).toEqual({ kind: 'idea_added', id: 'i-new' });
    expect(notifyEventFor(remove('notes', n.id))).toBeNull();
    expect(notifyEventFor(update('guests', 'g-1', { rsvp: 'Yes' }))).toBeNull();
  });
});
