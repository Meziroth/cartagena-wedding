// Where wedding data comes from. Phase 1 only has the in-memory mock; Supabase plugs in behind the same interface.
import { buildMockData, MOCK_USERS, type Dataset } from '../mock/mockData';
import type { Member } from '../types';

export interface DataSource {
  kind: 'mock' | 'supabase';
  loadDataset(): Promise<Dataset>;
  currentMember(): Promise<Member>;
}

function mockSource(): DataSource {
  // Kept in memory so edits survive navigation but not a reload.
  const data = buildMockData();
  return {
    kind: 'mock',
    loadDataset: async () => structuredClone(data),
    currentMember: async () => data.members.find((m) => m.user_id === MOCK_USERS.nick)!,
  };
}

const wantsMock = import.meta.env.VITE_DATA_SOURCE === 'mock' || !import.meta.env.VITE_SUPABASE_URL;

// TODO(phase 2–3): return a Supabase-backed source when wantsMock is false.
export const dataSource: DataSource = wantsMock ? mockSource() : mockSource();
