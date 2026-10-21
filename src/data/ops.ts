// Every edit is an Op. The same pure applyOp() updates the on-screen copy immediately (optimistic update), and
// runs the example-data source; the Supabase source turns each Op into a database call.
import { addDays, daysBetween } from '../lib/dates';
import type { Dataset } from '../mock/mockData';
import type { Wedding } from '../types';

/** Tables held as lists in the Dataset (everything except the single wedding row). */
export type ListTable = Exclude<keyof Dataset, 'wedding'>;
export type RowOf<K extends ListTable> = Dataset[K][number];

export type Op =
  | { type: 'insert'; table: ListTable; row: Record<string, unknown> }
  | { type: 'update'; table: ListTable; match: Record<string, unknown>; patch: Record<string, unknown> }
  | { type: 'delete'; table: ListTable; match: Record<string, unknown> }
  | { type: 'updateWedding'; weddingId: string; patch: Partial<Omit<Wedding, 'id' | 'wedding_date'>> }
  /** New total (or null to keep it) and category amounts, saved together. */
  | { type: 'saveBudget'; weddingId: string; total: number | null; amounts: Record<string, number> }
  /** Moves the date and shifts every task by the same number of days. */
  | { type: 'setWeddingDate'; weddingId: string; date: string };

// Typed builders, so call sites can't misspell a column.
export const insert = <K extends ListTable>(table: K, row: RowOf<K>): Op => ({ type: 'insert', table, row: { ...row } });
export const update = <K extends ListTable>(table: K, id: string, patch: Partial<RowOf<K>>): Op =>
  ({ type: 'update', table, match: { id }, patch: { ...patch } });
export const remove = <K extends ListTable>(table: K, id: string): Op => ({ type: 'delete', table, match: { id } });

const matches = (row: object, match: Record<string, unknown>) =>
  Object.entries(match).every(([k, v]) => (row as Record<string, unknown>)[k] === v);

/** Applies an Op to a dataset without mutating it. */
export function applyOp(d: Dataset, op: Op): Dataset {
  switch (op.type) {
    case 'insert':
      return { ...d, [op.table]: [...d[op.table], op.row] };
    case 'update':
      return { ...d, [op.table]: (d[op.table] as object[]).map((r) => (matches(r, op.match) ? { ...r, ...op.patch } : r)) };
    case 'delete':
      return { ...d, [op.table]: (d[op.table] as object[]).filter((r) => !matches(r, op.match)) };
    case 'updateWedding':
      return { ...d, wedding: { ...d.wedding, ...op.patch } };
    case 'saveBudget':
      return {
        ...d,
        wedding: op.total === null ? d.wedding : { ...d.wedding, total_budget_usd: op.total },
        budget_categories: d.budget_categories.map((c) =>
          c.id in op.amounts ? { ...c, amount_usd: op.amounts[c.id] } : c),
      };
    case 'setWeddingDate': {
      const shift = daysBetween(d.wedding.wedding_date, op.date);
      return {
        ...d,
        wedding: { ...d.wedding, wedding_date: op.date },
        tasks: d.tasks.map((x) => ({ ...x, due_date: addDays(x.due_date, shift) })),
      };
    }
  }
}
