// Saving edits: the screen updates at once (optimistic), the change is saved, and if saving fails the screen
// rolls back and a toast says what went wrong. Changes are saved one after another, in the order they're made.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dataset } from '../mock/mockData';
import { useToast } from '../state/toast';
import { useWedding } from '../state/wedding';
import { applyOp, type Op } from './ops';
import { qk } from './queries';
import { ChangeError, dataSource } from './source';

const MUTATION_KEY = ['change'] as const;

export function useChangeErrorMessage(): (e: unknown) => string {
  const { t } = useTranslation();
  return useCallback((e: unknown) => {
    if (!navigator.onLine) return t('errors.offline');
    if (e instanceof ChangeError) {
      if (e.reason === 'server' && e.message) return e.message;
      if (e.reason === 'denied') return t('errors.denied');
      if (e.reason === 'offline') return t('errors.offline');
    }
    return t('errors.notSaved');
  }, [t]);
}

interface Vars { ops: Op[]; before: Dataset | undefined; success?: string }

/** Returns save(op or ops, success toast?). */
export function useChange(): (ops: Op | Op[], success?: string) => void {
  const { data } = useWedding();
  const key = qk.dataset(data.wedding.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const message = useChangeErrorMessage();

  const { mutate } = useMutation({
    mutationKey: MUTATION_KEY,
    scope: { id: 'wedding-changes' }, // saved one at a time, in order
    mutationFn: async ({ ops }: Vars) => {
      for (const op of ops) await dataSource.run(op);
    },
    onError: (e, { before }) => {
      if (before) queryClient.setQueryData(key, before);
      toast(message(e));
    },
    onSuccess: (_r, { success }) => { if (success) toast(success); },
    onSettled: () => {
      // Refetch once the last pending change has finished, so the screen matches the database
      // (who ticked a task, server timestamps) without flickering between changes.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) === 1) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return useCallback((input: Op | Op[], success?: string) => {
    const ops = Array.isArray(input) ? input : [input];
    // Apply right away, in the same event, so controls never flick back. A refetch already in flight would
    // overwrite this with older data, so stop it first (keeping what's on screen).
    void queryClient.cancelQueries({ queryKey: key }, { revert: false });
    const before = queryClient.getQueryData<Dataset>(key);
    if (before) queryClient.setQueryData<Dataset>(key, ops.reduce(applyOp, before));
    mutate({ ops, before, success });
  }, [queryClient, key, mutate]);
}
