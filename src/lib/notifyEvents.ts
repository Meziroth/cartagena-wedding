// Which saved edits should notify the others' phones. The notify Edge Function looks the row up itself, so only
// the kind and the row id travel.
import type { Op } from '../data/ops';

export const NOTIFY_KINDS = ['note_created', 'note_edited', 'idea_added', 'task_done'] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export interface NotifyEvent { kind: NotifyKind; id: string }

const NOTE_FIELDS = ['body', 'type', 'tags'];

export function notifyEventFor(op: Op): NotifyEvent | null {
  if (op.type === 'insert' && op.table === 'notes') return { kind: 'note_created', id: String(op.row.id) };
  if (op.type === 'insert' && op.table === 'ideas') return { kind: 'idea_added', id: String(op.row.id) };
  if (op.type === 'update' && op.table === 'notes' && NOTE_FIELDS.some((f) => f in op.patch)) {
    return { kind: 'note_edited', id: String(op.match.id) };
  }
  if (op.type === 'update' && op.table === 'tasks' && op.patch.is_done === true) return { kind: 'task_done', id: String(op.match.id) };
  return null;
}
