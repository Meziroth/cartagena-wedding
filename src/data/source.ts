// Where wedding data comes from: the in-memory example data, or Supabase. Screens only see this interface.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { buildMockData, type Dataset } from '../mock/mockData';
import type { Member, Role } from '../types';

export interface InviteInput {
  email: string;
  displayName: string;
  role: Role;
}

/** invited: an email went out. added: they already had an account, so they can sign in now. */
export type InviteResult = 'invited' | 'added' | 'already';

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
}

/** An error whose message is already written for people, not developers. */
export class FriendlyError extends Error {}

function mockSource(): DataSource {
  // Kept in memory so edits survive navigation but not a reload.
  const data = buildMockData();
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
  };
}

export const dataSource: DataSource = supabase ? supabaseSource(supabase) : mockSource();
