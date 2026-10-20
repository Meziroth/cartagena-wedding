// Runs the real migrations in PGlite (Postgres compiled to WebAssembly) on top of a small Supabase stand-in,
// then runs supabase/tests/rls.sql. No Docker or Supabase project needed.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSeedSql, SEED_SQL_PATH } from '../gen/seedSql';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const MIGRATIONS = 'supabase/migrations';

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(read('supabase/tests/support/supabase-shim.sql'));
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(read(join(MIGRATIONS, f)));
  }
  return db;
}

describe('database', () => {
  let db: PGlite;
  beforeAll(async () => { db = await freshDb(); }, 60_000);

  it('turns on RLS for every table in public', async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
    expect(rows).toEqual([]);
  });

  it('publishes every table to realtime', async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'`);
    expect(rows[0].n).toBe(12);
  });

  it('passes every check in rls.sql', async () => {
    const results = await db.exec(read('supabase/tests/rls.sql'));
    const passed = results.some((r) => r.rows.some((row) => (row as { result?: string }).result === 'All RLS checks passed'));
    expect(passed).toBe(true);
    // rls.sql rolls back, so the database is empty again.
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.weddings');
    expect(rows[0].n).toBe(0);
  }, 60_000);
});

describe('seed', () => {
  it('setup_wedding() is generated from src/lib/seedData.ts (run `npm run gen:seed` if this fails)', () => {
    expect(read(SEED_SQL_PATH)).toBe(buildSeedSql());
  });
});
