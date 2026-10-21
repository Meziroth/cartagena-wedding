import { useQuery } from '@tanstack/react-query';
import { dataSource, type Bucket } from './source';

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

/** Signed addresses for private files, refreshed well before their hour runs out. */
export const useFileUrls = (bucket: Bucket, paths: string[]) => {
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ['fileUrls', bucket, sorted] as const,
    queryFn: () => dataSource.fileUrls(bucket, sorted),
    enabled: sorted.length > 0,
    staleTime: 40 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};
