import { useQuery } from '@tanstack/react-query';
import type { Dataset } from '../mock/mockData';
import type { Member } from '../types';
import { readCache, writeCache } from './offlineCache';
import { dataSource, type Bucket } from './source';

// Bump when the cached shape changes, so an old copy is never read as new.
const CACHE_VERSION = 2;

export const qk = {
  me: (userId: string) => ['me', userId] as const,
  dataset: (weddingId: string) => ['dataset', weddingId] as const,
  canSetUp: ['canSetUp'] as const,
};

// Both start from this device's last copy (if any) and refresh from the server straight away.
export const useMe = (userId: string) => {
  const cached = readCache<Member | null>(userId, `me-v${CACHE_VERSION}`);
  return useQuery({
    queryKey: qk.me(userId),
    queryFn: async () => {
      const me = await dataSource.currentMember(userId);
      writeCache(userId, `me-v${CACHE_VERSION}`, me);
      return me;
    },
    initialData: cached?.value ?? undefined,
    initialDataUpdatedAt: cached?.savedAt,
  });
};

export const useDataset = (weddingId: string, userId: string) => {
  const part = `dataset-v${CACHE_VERSION}:${weddingId}`;
  const cached = readCache<Dataset>(userId, part);
  return useQuery({
    queryKey: qk.dataset(weddingId),
    queryFn: async () => {
      const d = await dataSource.loadDataset(weddingId);
      writeCache(userId, part, d);
      return d;
    },
    initialData: cached?.value,
    initialDataUpdatedAt: cached?.savedAt,
  });
};

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
