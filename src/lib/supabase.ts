// The one Supabase client. Without VITE_SUPABASE_URL (or with VITE_DATA_SOURCE=mock) there is none,
// and the app runs on the built-in example data instead.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const USE_MOCK = import.meta.env.VITE_DATA_SOURCE === 'mock' || !url || !anonKey;

/**
 * What an emailed link was for, read before the client swaps the tokens in the URL for a session.
 * Invite and password-reset links both end on the "choose a password" screen.
 */
export const ARRIVED_FOR: 'invite' | 'recovery' | null = (() => {
  if (typeof window === 'undefined') return null;
  const type = new URLSearchParams(window.location.hash.slice(1)).get('type');
  return type === 'invite' || type === 'recovery' ? type : null;
})();

export const supabase: SupabaseClient | null = USE_MOCK ? null : createClient(url!, anonKey!);

/** Where emailed links send people back to: this app's own address, e.g. https://…github.io/cartagena-wedding/. */
export const redirectUrl = () => window.location.origin + import.meta.env.BASE_URL;
