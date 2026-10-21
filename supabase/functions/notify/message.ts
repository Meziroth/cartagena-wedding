// What a notification says. Plain TypeScript with no Deno APIs, so Vitest can test it too.

export type NotifyKind = 'note_created' | 'note_edited' | 'idea_added' | 'task_done';
const KINDS: NotifyKind[] = ['note_created', 'note_edited', 'idea_added', 'task_done'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NotifyRequest { kind?: NotifyKind; id?: string; test?: true }

export function parseNotify(body: unknown): { event: NotifyRequest } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Send { kind, id } as JSON.' };
  const b = body as Record<string, unknown>;
  if (b.test === true) return { event: { test: true } };
  if (!KINDS.includes(b.kind as NotifyKind)) return { error: 'Unknown notification kind.' };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return { error: 'Missing row id.' };
  return { event: { kind: b.kind as NotifyKind, id: b.id } };
}

export interface PushMessage {
  title: string;
  body: string;
  /** Opened when the notification is tapped, relative to the app (a hash route). */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

/** Shortens to about `n` characters on a word boundary, adding "…". */
export function clip(text: string, n = 120): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).trimEnd()}…`;
}

const TYPE_WORD: Record<string, string> = { decision: 'decision', note: 'note', question: 'question' };

export function buildMessage(kind: NotifyKind | 'test', who: string, row: Record<string, unknown>): PushMessage {
  const str = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
  switch (kind) {
    case 'note_created':
      return { title: `${who} added a ${TYPE_WORD[str('type')] ?? 'note'}`, body: clip(str('body')), url: '#/notes', tag: `note-${str('id')}` };
    case 'note_edited':
      return { title: `${who} edited a ${TYPE_WORD[str('type')] ?? 'note'}`, body: clip(str('body')), url: '#/notes', tag: `note-${str('id')}` };
    case 'idea_added':
      return { title: `${who} added inspiration`, body: clip(str('title') || str('preview_title') || 'A new idea on the board'), url: '#/inspiration', tag: `ideas-${str('created_by')}` }; // a batch of photos replaces, not piles up
    case 'task_done':
      return { title: `${who} checked off a task`, body: clip(str('title')), url: '#/checklist', tag: `task-${str('id')}` };
    case 'test':
      return { title: 'Notifications are working', body: 'You’ll hear about new notes and inspiration here.', url: '#/', tag: 'test' };
  }
}
