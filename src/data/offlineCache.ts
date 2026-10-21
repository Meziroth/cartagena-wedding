// The last plan this device loaded, kept in localStorage so the Home Screen app opens with no signal
// (a hacienda courtyard isn't always covered). Per person; removed when they sign out.
import { USE_MOCK } from '../lib/supabase';

const PREFIX = 'nt-cache:';
const key = (userId: string, part: string) => `${PREFIX}${userId}:${part}`;

interface Entry<T> { savedAt: number; value: T }

export function readCache<T>(userId: string, part: string): Entry<T> | undefined {
  if (USE_MOCK) return undefined;
  try {
    const raw = localStorage.getItem(key(userId, part));
    return raw ? (JSON.parse(raw) as Entry<T>) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(userId: string, part: string, value: T): void {
  if (USE_MOCK) return;
  try {
    localStorage.setItem(key(userId, part), JSON.stringify({ savedAt: Date.now(), value }));
  } catch { /* full or blocked: the app still works online */ }
}

/** Forget everything cached for this person (or for everyone when no id is given). */
export function clearCache(userId?: string): void {
  try {
    const prefix = userId ? `${PREFIX}${userId}:` : PREFIX;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}
