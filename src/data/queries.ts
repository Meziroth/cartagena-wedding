import { useQuery } from '@tanstack/react-query';
import { dataSource } from './source';

export const qk = {
  me: (userId: string) => ['me', userId] as const,
  dataset: (weddingId: string) => ['dataset', weddingId] as const,
  canSetUp: ['canSetUp'] as const,
};

export const useMe = (userId: string) =>
  useQuery({ queryKey: qk.me(userId), queryFn: () => dataSource.currentMember(userId) });

export const useDataset = (weddingId: string | undefined) =>
  useQuery({
    queryKey: qk.dataset(weddingId ?? ''),
    queryFn: () => dataSource.loadDataset(weddingId!),
    enabled: !!weddingId,
  });

export const useCanSetUp = (enabled: boolean) =>
  useQuery({ queryKey: qk.canSetUp, queryFn: () => dataSource.canSetUpWedding(), enabled });
