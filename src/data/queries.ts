import { useQuery } from '@tanstack/react-query';
import { dataSource } from './source';

export const qk = {
  dataset: ['dataset'] as const,
  me: ['me'] as const,
};

export const useDataset = () => useQuery({ queryKey: qk.dataset, queryFn: () => dataSource.loadDataset() });

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => dataSource.currentMember() });
