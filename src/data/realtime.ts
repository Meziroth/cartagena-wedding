// Live sync: when someone else changes the wedding, Supabase realtime tells this browser, and the screen refetches.
// RLS applies to realtime too, so each person only hears about their own wedding.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { qk } from './queries';

const TABLES = ['weddings', 'members', 'events', 'budget_categories', 'payments', 'tasks', 'vendors', 'ideas',
  'idea_votes', 'guests', 'notes', 'dismissed_suggestions'] as const;

/** Changes often arrive in bursts (a rebalance touches many rows); refetch once they settle. */
const SETTLE_MS = 300;

export function useRealtime(weddingId: string, userId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    let timer: number | undefined;
    let joinedBefore = false;

    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // While this device is still saving its own edits, those saves refetch when they finish.
        if (queryClient.isMutating({ mutationKey: ['change'] }) > 0) return refresh();
        void queryClient.invalidateQueries({ queryKey: qk.dataset(weddingId) });
      }, SETTLE_MS);
    };

    const channel = sb.channel(`wedding:${weddingId}`);
    for (const table of TABLES) {
      const filter = table === 'weddings' ? `id=eq.${weddingId}` : table === 'idea_votes' ? undefined : `wedding_id=eq.${weddingId}`;
      channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => {
        // A role change or removal affects what this person may do, not just what they see.
        if (table === 'members') void queryClient.invalidateQueries({ queryKey: qk.me(userId) });
        refresh();
      });
    }
    channel.subscribe((status) => {
      // After a dropped connection, catch up on whatever changed while we weren't listening.
      if (status === 'SUBSCRIBED') { if (joinedBefore) refresh(); joinedBefore = true; }
    });

    return () => {
      window.clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [queryClient, weddingId, userId]);
}
