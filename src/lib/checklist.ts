// Checklist filters and month grouping, as in the prototype.
import type { Task } from '../types';
import { daysBetween } from './dates';

export const TASK_FILTERS = ['All', 'Open', 'Done', 'Nick', 'Thuraya', 'Planner'] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];

export const TASK_AREAS = [
  'Planning', 'Venue', 'Vendors', 'Guests', 'Travel', 'Florals', 'Décor', 'Catering', 'Music', 'Attire', 'Ceremony',
  'Legal', 'Budget', 'Events',
] as const;

/** "Both" tasks show for Nick and for Thuraya, not for the planner. */
export function filterTasks(tasks: readonly Task[], f: TaskFilter): Task[] {
  const sorted = [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.sort - b.sort);
  switch (f) {
    case 'Open': return sorted.filter((x) => !x.is_done);
    case 'Done': return sorted.filter((x) => x.is_done);
    case 'Nick':
    case 'Thuraya': return sorted.filter((x) => x.assignee === f || x.assignee === 'Both');
    case 'Planner': return sorted.filter((x) => x.assignee === 'Planner');
    default: return sorted;
  }
}

/** Groups already-sorted tasks by due month ('2027-03'), keeping order. */
export function groupByMonth(tasks: readonly Task[]): [month: string, tasks: Task[]][] {
  const groups = new Map<string, Task[]>();
  for (const x of tasks) {
    const k = x.due_date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  return [...groups];
}

/** Whole months from the middle of `month` to the wedding, as in the prototype (0 = the wedding month). */
export const monthsOut = (month: string, weddingDate: string): number =>
  Math.round(daysBetween(`${month}-15`, weddingDate) / 30.4);

export const isOverdue = (x: Task, today: string): boolean => !x.is_done && x.due_date < today;
