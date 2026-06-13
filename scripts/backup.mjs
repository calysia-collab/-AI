import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppDatabase } from '../api/database.mjs';
import { backupContext, dataProtection, root } from './runtime-security.mjs';

const source = resolve(process.env.SASHA_DB_PATH || join(root, '.data', 'sasha-workbench.sqlite'));
const backupDirectory = resolve(process.env.SASHA_BACKUP_DIR || join(root, 'backups'));

if (!existsSync(source)) {
  throw new Error(`找不到要備份的資料庫：${source}`);
}

await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = join(backupDirectory, `sasha-workbench-${timestamp}.sashabak`);
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-backup-'));
const temporaryDatabase = join(temporaryDirectory, 'backup.sqlite');
let integrity;
let revision;
try {
  const database = createAppDatabase(source, { dataProtection });
  try {
    database.backupTo(temporaryDatabase);
  } finally {
    database.close();
  }

  const verificationDatabase = createAppDatabase(temporaryDatabase, { dataProtection });
  try {
    integrity = verificationDatabase.verifyIntegrity();
    revision = verificationDatabase.getRevision();
  } finally {
    verificationDatabase.close();
  }
  await writeFile(
    destination,
    dataProtection.protectBuffer(await readFile(temporaryDatabase), backupContext),
    { flag: 'wx', mode: 0o600 }
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

if (integrity.some((result) => result !== 'ok')) {
  throw new Error(`備份完整性檢查失敗：${integrity.join(', ')}`);
}

console.log(JSON.stringify({
  status: 'ok',
  source,
  backup: destination,
  revision,
  integrity
}, null, 2));
