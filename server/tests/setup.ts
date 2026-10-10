import 'dotenv/config';
import { execSync } from 'node:child_process';
import { copyFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const testDb = resolve(process.cwd(), 'prisma/test.db');
const devDb = resolve(process.cwd(), 'prisma/dev.db');

try {
  rmSync(testDb);
} catch {
  // did not exist
}

process.env.DATABASE_URL = `file:${testDb}`;
process.env.NODE_ENV = 'test';

// Fast path: clone the already-migrated dev database instead of running
// `prisma db push` (which introspects the schema and costs ~12s). Tests wipe
// every table in beforeAll, so any seed rows are discarded immediately.
// Fall back to a real schema push when no dev database exists yet.
if (existsSync(devDb)) {
  copyFileSync(devDb, testDb);
} else {
  execSync('prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: `file:${testDb}` },
    stdio: 'ignore',
  });
}
