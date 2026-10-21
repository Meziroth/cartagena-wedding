import { describe, expect, it } from 'vitest';
import { parseInvite } from '../functions/invite/validate.ts';
import { buildMessage, clip, parseNotify } from '../functions/notify/message.ts';

describe('invite request', () => {
  it('normalizes a valid invite', () => {
    expect(parseInvite({ email: ' Thuraya@Example.COM ', displayName: ' Thuraya ', role: 'owner', redirectTo: 'https://x.github.io/cartagena-wedding/' }))
      .toEqual({ invite: { email: 'thuraya@example.com', displayName: 'Thuraya', role: 'owner', redirectTo: 'https://x.github.io/cartagena-wedding/' } });
  });

  it('rejects bad emails, names and roles', () => {
    expect(parseInvite(null)).toHaveProperty('error');
    expect(parseInvite({ email: 'nope', displayName: 'A', role: 'planner' })).toEqual({ error: 'Enter a valid email address.' });
    expect(parseInvite({ email: 'a@b.co', displayName: '  ', role: 'planner' })).toEqual({ error: 'Enter their name.' });
    expect(parseInvite({ email: 'a@b.co', displayName: 'x'.repeat(61), role: 'planner' })).toHaveProperty('error');
    expect(parseInvite({ email: 'a@b.co', displayName: 'A', role: 'admin' })).toEqual({ error: 'Choose Owner or Planner.' });
  });

  it('drops redirect addresses that aren’t web URLs', () => {
    const r = parseInvite({ email: 'a@b.co', displayName: 'A', role: 'planner', redirectTo: 'javascript:alert(1)' });
    expect(r).toEqual({ invite: { email: 'a@b.co', displayName: 'A', role: 'planner', redirectTo: undefined } });
  });
});

describe('notify messages', () => {
  const id = '6b0a2c56-0d4f-4b7e-9a51-1f1c1d2e3f40';

  it('accepts only known kinds with a row id, or a test', () => {
    expect(parseNotify({ kind: 'note_created', id })).toEqual({ event: { kind: 'note_created', id } });
    expect(parseNotify({ test: true })).toEqual({ event: { test: true } });
    expect(parseNotify({ kind: 'everything', id })).toHaveProperty('error');
    expect(parseNotify({ kind: 'task_done', id: 'not-a-uuid' })).toHaveProperty('error');
    expect(parseNotify(null)).toHaveProperty('error');
  });

  it('says who did what, with a short preview and where to go', () => {
    expect(buildMessage('note_created', 'Thuraya', { id, type: 'question', body: 'Legal in Colombia?' }))
      .toEqual({ title: 'Thuraya added a question', body: 'Legal in Colombia?', url: '#/notes', tag: `note-${id}` });
    expect(buildMessage('task_done', 'Planner', { id, title: 'Book the hacienda' }).title).toBe('Planner checked off a task');
    expect(buildMessage('idea_added', 'Nick', { id, title: '' }).body).toBe('A new idea on the board');
  });

  it('clips long text on a word boundary', () => {
    const s = clip('word '.repeat(60), 40);
    expect(s.length).toBeLessThanOrEqual(41);
    expect(s.endsWith('word…')).toBe(true);
  });
});
