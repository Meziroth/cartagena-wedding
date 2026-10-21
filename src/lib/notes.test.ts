import { describe, expect, it } from 'vitest';
import type { Note } from '../types';
import { addTags, filterNotes, normalizeTag, sortNotes, tagsInUse, wasEdited } from './notes';

const note = (id: string, body: string, extra: Partial<Note> = {}): Note => ({
  id, wedding_id: 'w', type: 'note', body, tags: [], created_by: null,
  created_at: '2026-10-20T12:00:00Z', updated_at: '2026-10-20T12:00:00Z', ...extra,
});

const notes = [
  note('a', 'Book the boat', { tags: ['travel'], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' }),
  note('b', 'about the budget', { type: 'decision', tags: ['budget', 'venue'], created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z' }),
  note('c', 'Cake tasting?', { type: 'question', created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' }),
];

describe('tags', () => {
  it('normalizes what people type', () => {
    expect(normalizeTag('  #Hora   Loca ')).toBe('hora loca');
    expect(normalizeTag('x'.repeat(40))).toHaveLength(30);
  });

  it('adds comma-separated tags without blanks or duplicates, up to ten', () => {
    expect(addTags(['venue'], 'Venue, florals, , #Lighting')).toEqual(['venue', 'florals', 'lighting']);
    expect(addTags([], Array.from({ length: 12 }, (_, i) => `t${i}`).join(','))).toHaveLength(10);
  });

  it('lists only tags in use, most used first', () => {
    expect(tagsInUse([...notes, note('d', 'x', { tags: ['venue'] })])).toEqual([
      { tag: 'venue', count: 2 }, { tag: 'budget', count: 1 }, { tag: 'travel', count: 1 },
    ]);
    expect(tagsInUse([note('e', 'untagged')])).toEqual([]);
  });
});

describe('sorting', () => {
  const ids = (list: Note[]) => list.map((n) => n.id);
  it('sorts by created, edited, A–Z, tag and type', () => {
    expect(ids(sortNotes(notes, 'created'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortNotes(notes, 'edited'))).toEqual(['a', 'b', 'c']);
    expect(ids(sortNotes(notes, 'alpha'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortNotes(notes, 'tag'))).toEqual(['b', 'a', 'c']); // budget, travel, then untagged
    expect(ids(sortNotes(notes, 'type'))).toEqual(['b', 'c', 'a']); // decision, question, note
  });
});

describe('search and filters', () => {
  const ids = (list: Note[]) => list.map((n) => n.id);
  it('matches every word against body, tags, type and author', () => {
    expect(ids(filterNotes(notes, { text: 'boat', type: 'all', tags: [] }))).toEqual(['a']);
    expect(ids(filterNotes(notes, { text: 'ven', type: 'all', tags: [] }))).toEqual(['b']);
    expect(ids(filterNotes(notes, { text: 'question', type: 'all', tags: [] }))).toEqual(['c']);
    expect(ids(filterNotes(notes, { text: 'thuraya', type: 'all', tags: [] }, (n) => (n.id === 'c' ? 'Thuraya' : 'Nick')))).toEqual(['c']);
    expect(ids(filterNotes(notes, { text: 'budget boat', type: 'all', tags: [] }))).toEqual([]);
  });

  it('treats #word as a tag search', () => {
    expect(ids(filterNotes(notes, { text: '#bud', type: 'all', tags: [] }))).toEqual(['b']);
    expect(ids(filterNotes(notes, { text: '#boat', type: 'all', tags: [] }))).toEqual([]);
  });

  it('filters by type and by every selected tag', () => {
    expect(ids(filterNotes(notes, { text: '', type: 'decision', tags: [] }))).toEqual(['b']);
    expect(ids(filterNotes(notes, { text: '', type: 'all', tags: ['budget', 'venue'] }))).toEqual(['b']);
    expect(ids(filterNotes(notes, { text: '', type: 'all', tags: ['budget', 'travel'] }))).toEqual([]);
  });

  it('knows when a note was edited later', () => {
    expect(wasEdited(notes[0])).toBe(true);
    expect(wasEdited(notes[1])).toBe(false);
  });
});
