// npm run gen:seed
import { writeFileSync } from 'node:fs';
import { buildSeedSql, SEED_SQL_PATH } from './seedSql';

writeFileSync(SEED_SQL_PATH, buildSeedSql());
console.log(`Wrote ${SEED_SQL_PATH}`);
