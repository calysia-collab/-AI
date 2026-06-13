import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppDatabase } from '../api/database.mjs';
import { backupContext, dataProtection, root } from './runtime-security.mjs';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const source = sourceIndex >= 0 && args[sourceIndex + 1] ? resolve(args[sourceIndex + 1]) : null;
const confirmed = args.includes('--confirm');
const target = resolve(process.env.SASHA_DB_PATH || join(root, '.data', 'sasha-workbench.sqlite'));

if (!source || !existsSync(source)) {
  throw new Error('請使用 --source 指定存在的備份檔。');
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-restore-'));
const preparedSource = join(temporaryDirectory, 'restore.sqlite');
const sourceBody = await readFile(source);
await writeFile(
  preparedSource,
  dataProtection.isProtectedBuffer(sourceBody)
    ? dataProtection.unprotectBuffer(sourceBody, backupContext)
    : sourceBody,
  { mode: 0o600 }
);
const sourceDatabase = createAppDatabase(preparedSource, { dataProtection });
try {
  const integrity = sourceDatabase.verifyIntegrity();
  if (integrity.some((result) => result !== 'ok')) {
    throw new Error(`來源備份完整性檢查失敗：${integrity.join(', ')}`);
  }
} finally {
  sourceDatabase.close();
}

if (!confirmed) {
  console.log(JSON.stringify({
    status: 'confirmation-required',
    source,
    target,
    instruction: '停止莎莎工作台伺服器後，加上 --confirm 才會執行還原。'
  }, null, 2));
  process.exitCode = 2;
} else {
  await mkdir(dirname(target), { recursive: true });
  const safetyCopy = existsSync(target)
    ? `${target}.before-restore-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.sashabak`
    : null;

  if (safetyCopy) {
    await writeFile(
      safetyCopy,
      dataProtection.protectBuffer(await readFile(target), backupContext),
      { flag: 'wx', mode: 0o600 }
    );
  }
  await rm(`${target}-wal`, { force: true });
  await rm(`${target}-shm`, { force: true });
  await copyFile(preparedSource, target);

  try {
    const restoredDatabase = createAppDatabase(target, { dataProtection });
    try {
      const integrity = restoredDatabase.verifyIntegrity();
      if (integrity.some((result) => result !== 'ok')) {
        throw new Error(`還原後完整性檢查失敗：${integrity.join(', ')}`);
      }
      console.log(JSON.stringify({
        status: 'ok',
        source,
        target,
        safetyCopy,
        revision: restoredDatabase.getRevision(),
        integrity
      }, null, 2));
    } finally {
      restoredDatabase.close();
    }
  } catch (error) {
    if (safetyCopy) {
      const encryptedSafetyCopy = await readFile(safetyCopy);
      await writeFile(
        target,
        dataProtection.unprotectBuffer(encryptedSafetyCopy, backupContext)
      );
    }
    throw error;
  }
}

await rm(temporaryDirectory, { recursive: true, force: true });
