import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createAppDatabase } from '../api/database.mjs';
import { connectPostgresqlDatabase } from '../api/postgresql-database.mjs';
import { backupContext, dataProtection } from './runtime-security.mjs';

const args = process.argv.slice(2);
const sourceArgument = args.find((item) => item.startsWith('--source='));
const source = resolve(
  sourceArgument
    ? sourceArgument.slice('--source='.length)
    : process.env.SASHA_DB_PATH || '.data/sasha-workbench.sqlite'
);
const confirmed = args.includes('--confirm');
if (!existsSync(source)) {
  throw new Error(`SQLite source database does not exist: ${source}`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-postgresql-import-'));
const sourceBody = await readFile(source);
const preparedSource = join(temporaryDirectory, 'source.sqlite');
await writeFile(
  preparedSource,
  dataProtection.isProtectedBuffer(sourceBody)
    ? dataProtection.unprotectBuffer(sourceBody, backupContext)
    : sourceBody,
  { mode: 0o600 }
);
const sqlite = createAppDatabase(preparedSource, { dataProtection });
let snapshot;
try {
  snapshot = sqlite.exportPostgresqlSnapshot();
} finally {
  sqlite.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({
  source,
  exportedAt: snapshot.exportedAt,
  counts: snapshot.counts,
  sessionsMigrated: false,
  requiresOriginalMasterKey: snapshot.users.some((user) => Boolean(user.mfa_secret_ciphertext))
}, null, 2));

if (!confirmed) {
  console.log('Preview only. Re-run with --confirm to import into an empty PostgreSQL database.');
  process.exit(0);
}

const connectionString = String(process.env.SASHA_DATABASE_URL || '').trim();
if (!connectionString) throw new Error('SASHA_DATABASE_URL is required.');
const mode = String(process.env.SASHA_DATABASE_SSL || 'verify-full').toLowerCase();
if (!['disable', 'require', 'verify-full'].includes(mode)) {
  throw new Error('SASHA_DATABASE_SSL must be disable, require, or verify-full.');
}
const ssl = mode === 'disable'
  ? false
  : { rejectUnauthorized: mode === 'verify-full' };
const postgresql = await connectPostgresqlDatabase({
  connectionString,
  max: Number(process.env.SASHA_DATABASE_POOL_SIZE || 10),
  ssl,
  dataProtection
});
try {
  const result = await postgresql.importPostgresqlSnapshot(snapshot);
  console.log(JSON.stringify({
    status: 'completed',
    counts: result.counts,
    sessionsMigrated: result.sessionsMigrated
  }, null, 2));
} finally {
  await postgresql.close();
}
