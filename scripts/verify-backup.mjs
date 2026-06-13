import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createAppDatabase } from '../api/database.mjs';
import { backupContext, dataProtection } from './runtime-security.mjs';

const backupPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!backupPath || !existsSync(backupPath)) {
  throw new Error('請提供存在的備份檔路徑，例如：node scripts/verify-backup.mjs backups/檔名.sqlite');
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-backup-verify-'));
const temporaryDatabase = join(temporaryDirectory, 'backup.sqlite');
const source = await readFile(backupPath);
await writeFile(
  temporaryDatabase,
  dataProtection.isProtectedBuffer(source)
    ? dataProtection.unprotectBuffer(source, backupContext)
    : source,
  { mode: 0o600 }
);
const database = createAppDatabase(temporaryDatabase, { dataProtection });
try {
  const integrity = database.verifyIntegrity();
  const state = database.getState();
  if (integrity.some((result) => result !== 'ok')) {
    throw new Error(`備份完整性檢查失敗：${integrity.join(', ')}`);
  }
  console.log(JSON.stringify({
    status: 'ok',
    backup: backupPath,
    revision: state.revision,
    records: {
      customers: state.customers.length,
      policies: state.policies.length,
      events: state.events.length,
      teamMembers: state.teamMembers.length,
      teamTasks: state.teamTasks.length
    },
    integrity
  }, null, 2));
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
