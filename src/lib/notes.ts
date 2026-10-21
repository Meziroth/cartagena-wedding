// Notes: tags, search, filters and sorting. Pure functions, so the Notes screen stays simple and testable.
import type { Note, NoteType } from '../types';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** "  #Hora  Loca " → "hora loca". Tags are compared and shown in lower case. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
}

/** Adds tags (comma-separated text is split), skipping blanks and duplicates, up to MAX_TAGS. */
export function addTags(current: readonly string[], input: string): string[] {
  const out = [...current];
  for (const part of input.split(',')) {
    const t = normalizeTag(part);
    if (t && !out.includes(t) && out.length < MAX_TAGS) out.push(t);
  }
  return out;
}

/** Every tag in use, with how many notes carry it, most used first, then A–Z. */
export function tagsInUse(notes: readonly Note[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const NOTE_SORTS = ['created', 'edited', 'alpha', 'tag', 'type'] as const;
export type NoteSort = (typeof NOTE_SORTS)[number];

const TYPE_ORDER: Record<NoteType, number> = { decision: 0, question: 1, note: 2 };
const newestFirst = (a: Note, b: Note) => b.created_at.localeCompare(a.created_at);

export function sortNotes(notes: readonly Note[], by: NoteSort): Note[] {
  const list = [...notes];
  switch (by) {
    case 'edited': return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || newestFirst(a, b));
    case 'alpha': return list.sort((a, b) => a.body.localeCompare(b.body, undefined, { sensitivity: 'base' }) || newestFirst(a, b));
    // By first tag A–Z; untagged notes go last.
    case 'tag': return list.sort((a, b) => {
      const ta = [...a.tags].sort()[0];
      const tb = [...b.tags].sort()[0];
      if (ta === undefined || tb === undefined) return (ta === undefined ? 1 : 0) - (tb === undefined ? 1 : 0) || newestFirst(a, b);
      return ta.localeCompare(tb) || newestFirst(a, b);
    });
    case 'type': return list.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || newestFirst(a, b));
    default: return list.sort(newestFirst);
  }
}

export interface NoteQuery {
  /** Free text. Words must all match the body, a tag, the type or the author; "#word" matches tags only. */
  text: string;
  type: NoteType | 'all';
  /** Only notes carrying every one of these tags. */
  tags: readonly string[];
}

export function filterNotes(notes: readonly Note[], q: NoteQuery, authorOf: (n: Note) => string = () => ''): Note[] {
  const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
  return notes.filter((n) => {
    if (q.type !== 'all' && n.type !== q.type) return false;
    if (!q.tags.every((t) => n.tags.includes(t))) return false;
    const hay = `${n.body} ${n.type} ${authorOf(n)}`.toLowerCase();
    return words.every((w) => w.startsWith('#')
      ? n.tags.some((t) => t.startsWith(normalizeTag(w)))
      : hay.includes(w) || n.tags.some((t) => t.includes(w)));
  });
}

/** Notes count as edited when they changed more than a minute after they were written. */
export const wasEdited = (n: Note): boolean =>
  new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 60_000;
