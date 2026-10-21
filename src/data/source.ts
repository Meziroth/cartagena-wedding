// Where wedding data comes from: the in-memory example data, or Supabase. Screens only see this interface.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { buildMockData, type Dataset } from '../mock/mockData';
import type { NotifyEvent } from '../lib/notifyEvents';
import type { Member, Role } from '../types';
import { applyOp, type Op } from './ops';

export interface InviteInput {
  email: string;
  displayName: string;
  role: Role;
}

/** invited: an email went out. added: they already had an account, so they can sign in now. */
export type InviteResult = 'invited' | 'added' | 'already';

export type Bucket = 'inspiration' | 'contracts';

export interface DataSource {
  kind: 'mock' | 'supabase';
  /** The signed-in person's membership, or null if they haven't been added to the wedding. */
  currentMember(userId: string): Promise<Member | null>;
  loadDataset(weddingId: string): Promise<Dataset>;
  /** True only before anyone has set up the wedding. */
  canSetUpWedding(): Promise<boolean>;
  setUpWedding(displayName: string): Promise<void>;
  inviteMember(input: InviteInput, redirectTo: string): Promise<InviteResult>;
  removeMember(weddingId: string, userId: string): Promise<void>;
  /** Saves one edit. Throws ChangeError when it can't. */
  run(op: Op): Promise<void>;
  /** Stores a file under the wedding's folder and returns its path, e.g. "{wedding_id}/{uuid}.pdf". */
  uploadFile(bucket: Bucket, weddingId: string, file: Blob, ext: string): Promise<string>;
  /** A short-lived address to open or show a private file. */
  fileUrl(bucket: Bucket, path: string): Promise<string>;
  deleteFile(bucket: Bucket, path: string): Promise<void>;
  /** Tells the others' phones about a saved change. Best effort: never throws. */
  notify(event: NotifyEvent): Promise<void>;
}

/** An error whose message is already written for people, not developers. */
export class FriendlyError extends Error {}

/**
 * Why an edit wasn't saved. denied: RLS refused it (for example, the planner and the budget).
 * server: the database explained itself in `message` (our own functions and triggers write these for people).
 */
export class ChangeError extends Error {
  constructor(public reason: 'offline' | 'denied' | 'server' | 'failed', message = '') { super(message); }
}

function mockSource(): DataSource {
  // Kept in memory so edits survive navigation but not a reload.
  let data = buildMockData();
  const files = new Map<string, string>();
  return {
    kind: 'mock',
    currentMember: async (userId) => data.members.find((m) => m.user_id === userId) ?? null,
    loadDataset: async () => structuredClone(data),
    canSetUpWedding: async () => false,
    setUpWedding: async () => {},
    inviteMember: async ({ email, displayName, role }) => {
      const e = email.trim().toLowerCase();
      if (data.members.some((m) => m.email === e)) return 'already';
      data.members.push({ wedding_id: data.wedding.id, user_id: `u-${crypto.randomUUID()}`, email: e, display_name: displayName, role });
      return 'invited';
    },
    removeMember: async (_weddingId, userId) => {
      data.members = data.members.filter((m) => m.user_id !== userId);
    },
    run: async (op) => {
      if (op.type === 'delete' && op.table === 'budget_categories'
          && data.budget_categories.some((c) => c.id === op.match.id && c.is_buffer)) {
        throw new ChangeError('server', 'The buffer category can\'t be deleted.');
      }
      data = applyOp(data, op);
    },
    uploadFile: async (_bucket, weddingId, file, ext) => {
      const path = `${weddingId}/${crypto.randomUUID()}.${ext}`;
      files.set(path, URL.createObjectURL(file));
      return path;
    },
    fileUrl: async (_bucket, path) => {
      const url = files.get(path);
      if (!url) throw new ChangeError('failed');
      return url;
    },
    deleteFile: async (_bucket, path) => {
      const url = files.get(path);
      if (url) URL.revokeObjectURL(url);
      files.delete(path);
    },
    notify: async () => {},
  };
}

// Every table is filtered by RLS to the signed-in member's wedding; the wedding_id filters keep queries tight.
const TABLE_ORDER: Record<Exclude<keyof Dataset, 'wedding' | 'idea_votes'>, [column: string, ascending: boolean]> = {
  members: ['display_name', true],
  events: ['sort', true],
  budget_categories: ['sort', true],
  payments: ['due_date', true],
  tasks: ['sort', true],
  vendors: ['name', true],
  ideas: ['created_at', false],
  guests: ['name', true],
  notes: ['created_at', false],
  dismissed_suggestions: ['suggestion_key', true],
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

interface PgError { code?: string; message?: string }

/** Postgres error → ChangeError. Our own functions and triggers raise messages written for people. */
function toChangeError(e: PgError | null | undefined): ChangeError {
  const msg = e?.message ?? '';
  if (!e?.code && /fetch|network|load failed/i.test(msg)) return new ChangeError('offline');
  if (/^(new row violates|permission denied)/i.test(msg)) return new ChangeError('denied');
  if (['P0001', 'P0002', '42501', '23514'].includes(e?.code ?? '') && !/violates check constraint/i.test(msg)) {
    return new ChangeError('server', msg);
  }
  return new ChangeError('failed', msg);
}

const check = ({ error }: { error: PgError | null }) => { if (error) throw toChangeError(error); };

/** Updates and deletes that RLS filters out touch no rows instead of failing, so count them. */
const checkTouched = ({ data, error }: { data: unknown[] | null; error: PgError | null }) => {
  if (error) throw toChangeError(error);
  if (!data?.length) throw new ChangeError('denied');
};

// The server sets these itself.
const SERVER_COLUMNS = ['created_at', 'updated_at'];
const withoutServerColumns = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !SERVER_COLUMNS.includes(k)));

function supabaseSource(sb: SupabaseClient): DataSource {
  return {
    kind: 'supabase',

    currentMember: async (userId) =>
      unwrap(await sb.from('members').select('*').eq('user_id', userId).limit(1).maybeSingle()) as Member | null,

    loadDataset: async (weddingId) => {
      const tables = Object.entries(TABLE_ORDER) as [keyof typeof TABLE_ORDER, [string, boolean]][];
      const [wedding, votes, ...rows] = await Promise.all([
        sb.from('weddings').select('*').eq('id', weddingId).single(),
        // idea_votes has no wedding_id; RLS limits it to votes on this wedding's ideas.
        sb.from('idea_votes').select('idea_id, user_id'),
        ...tables.map(([table, [column, ascending]]) =>
          sb.from(table).select('*').eq('wedding_id', weddingId).order(column, { ascending })),
      ]);
      const out = { wedding: unwrap(wedding), idea_votes: unwrap(votes) } as Dataset;
      tables.forEach(([table], i) => { (out as unknown as Record<string, unknown>)[table] = unwrap(rows[i]); });
      // numeric columns can arrive as strings; the app works in numbers.
      out.wedding.fx_cop_per_usd = Number(out.wedding.fx_cop_per_usd);
      out.tasks = out.tasks.map((x) => ({ ...x, months_before: x.months_before === null ? null : Number(x.months_before) }));
      return out;
    },

    canSetUpWedding: async () => unwrap(await sb.rpc('can_set_up_wedding')) === true,

    setUpWedding: async (displayName) => {
      const { error } = await sb.rpc('setup_wedding', { p_display_name: displayName });
      if (error) throw new FriendlyError(error.message);
    },

    inviteMember: async (input, redirectTo) => {
      const { data, error } = await sb.functions.invoke<{ status: InviteResult }>('invite', { body: { ...input, redirectTo } });
      if (error) {
        // The function answers errors with { error: "…" } written for people.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw body?.error ? new FriendlyError(body.error) : error;
      }
      return data!.status;
    },

    removeMember: async (weddingId, userId) => {
      const { data, error } = await sb.from('members').delete().eq('wedding_id', weddingId).eq('user_id', userId).select();
      if (error) throw new FriendlyError(error.message);
      if (!data?.length) throw new Error('Nothing was removed.');
    },

    run: async (op) => {
      try {
        switch (op.type) {
          case 'insert':
            return check(await sb.from(op.table).insert(withoutServerColumns(op.row)));
          case 'update': {
            let q = sb.from(op.table).update(op.patch);
            for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
            return checkTouched(await q.select());
          }
          case 'delete': {
            let q = sb.from(op.table).delete();
            for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
            return checkTouched(await q.select());
          }
          case 'updateWedding':
            return checkTouched(await sb.from('weddings').update(op.patch).eq('id', op.weddingId).select());
          case 'saveBudget':
            return check(await sb.rpc('save_budget', { p_wedding: op.weddingId, p_total: op.total, p_amounts: op.amounts }));
          case 'setWeddingDate':
            return check(await sb.rpc('set_wedding_date', { p_wedding: op.weddingId, p_date: op.date }));
        }
      } catch (e) {
        throw e instanceof ChangeError ? e : toChangeError(e as PgError);
      }
    },

    uploadFile: async (bucket, weddingId, file, ext) => {
      const path = `${weddingId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
      if (error) throw toChangeError(error);
      return path;
    },

    fileUrl: async (bucket, path) => {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (error || !data) throw toChangeError(error);
      return data.signedUrl;
    },

    deleteFile: async (bucket, path) => {
      const { error } = await sb.storage.from(bucket).remove([path]);
      if (error) throw toChangeError(error);
    },

    notify: async (event) => {
      try {
        const { error } = await sb.functions.invoke('notify', { body: event });
        if (error) console.warn('Notification not sent', error);
      } catch (e) {
        console.warn('Notification not sent', e);
      }
    },
  };
}

export const dataSource: DataSource = supabase ? supabaseSource(supabase) : mockSource();
