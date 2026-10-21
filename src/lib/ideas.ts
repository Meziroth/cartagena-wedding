// Inspiration board: filters, sorting and "both love it". Pure functions, tested in ideas.test.ts.
import type { Idea, IdeaTag, IdeaVote, Member } from '../types';

export const IDEA_TAGS: IdeaTag[] = ['Venue', 'Florals', 'Lighting', 'Décor', 'Palette', 'Attire', 'Cake', 'Other'];
export type IdeaFilter = 'All' | 'Both love' | IdeaTag;
export const IDEA_FILTERS: IdeaFilter[] = ['All', 'Both love', ...IDEA_TAGS];
export type IdeaSort = 'new' | 'loved';

export const ownerIds = (members: readonly Member[]): string[] =>
  members.filter((m) => m.role === 'owner').map((m) => m.user_id);

export const heartsFor = (ideaId: string, votes: readonly IdeaVote[]): Set<string> =>
  new Set(votes.filter((v) => v.idea_id === ideaId).map((v) => v.user_id));

/** Every owner has hearted it (not a hard-coded pair of names). */
export function bothLove(ideaId: string, votes: readonly IdeaVote[], owners: readonly string[]): boolean {
  const h = heartsFor(ideaId, votes);
  return owners.length > 0 && owners.every((o) => h.has(o));
}

export function boardIdeas(
  ideas: readonly Idea[], votes: readonly IdeaVote[], owners: readonly string[], filter: IdeaFilter, sort: IdeaSort,
): Idea[] {
  const list = ideas.filter((i) =>
    filter === 'All' ? true : filter === 'Both love' ? bothLove(i.id, votes, owners) : i.tag === filter);
  const newest = (a: Idea, b: Idea) => b.created_at.localeCompare(a.created_at);
  if (sort === 'loved') {
    const n = (i: Idea) => heartsFor(i.id, votes).size;
    return list.sort((a, b) => n(b) - n(a) || newest(a, b));
  }
  return list.sort(newest);
}

/** "https://www.pinterest.com/pin/1" → "pinterest.com"; "" when it isn't a URL. */
export function hostOf(url: string | null): string {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { return ''; }
}

/** Accepts what people paste: adds https:// when missing; null unless it's a web address. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString() : null;
  } catch { return null; }
}

/** Fits width × height inside a square of `max`, keeping the shape; never enlarges. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
