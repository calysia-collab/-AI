import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAppDatabase } from '../api/database.mjs';
import { createDataProtectionService } from '../api/data-protection.mjs';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-backup-drill-'));
const source = join(temporaryDirectory, 'source.sqlite');
const restored = join(temporaryDirectory, 'restored.sqlite');
const backupDirectory = join(temporaryDirectory, 'backups');
const masterKey = Buffer.alloc(32, 31).toString('base64');
const dataKey = Buffer.alloc(32, 32).toString('base64');
const environment = {
  ...process.env,
  SASHA_BACKUP_DIR: backupDirectory,
  SASHA_DATA_KEY_ID: 'drill-v1',
  SASHA_DATA_KEYS: JSON.stringify({ 'drill-v1': dataKey }),
  SASHA_MASTER_KEY: masterKey
};
const dataProtection = createDataProtectionService({
  currentKeyId: 'drill-v1',
  keys: { 'drill-v1': dataKey }
});

function run(script, args = [], extraEnvironment = {}, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...environment, ...extraEnvironment }
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${script} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  return result.stdout;
}

try {
  const database = createAppDatabase(source, { dataProtection });
  try {
    database.createOrganizationOwner({
      organizationId: 'org-drill',
      organizationName: 'Sasha Backup Drill',
      userId: 'user-drill',
      displayName: 'Manager Zhang',
      username: 'backup.drill',
      passwordHash: 'test-hash',
      passwordSalt: 'test-salt'
    });
    database.createOrganizationCustomer('org-drill', 'user-drill', {
      id: 'customer-drill',
      name: 'Backup Customer',
      phone: '0912-345-678',
      email: 'backup@example.com',
      birthday: '1980-01-01',
      ownerUserId: 'user-drill',
      owner: 'Manager Zhang',
      stage: 'active',
      nextFollowUp: '2026-06-30',
      needs: 'Protection review',
      note: 'Backup and restore validation'
    });
  } finally {
    database.close();
  }

  run('scripts/backup.mjs', [], { SASHA_DB_PATH: source });
  const backups = (await readdir(backupDirectory)).filter((name) => name.endsWith('.sashabak'));
  assert.equal(backups.length, 1);
  const backup = join(backupDirectory, backups[0]);
  run('scripts/verify-backup.mjs', [backup]);
  run(
    'scripts/restore-backup.mjs',
    ['--source', backup],
    { SASHA_DB_PATH: restored },
    2
  );
  run(
    'scripts/restore-backup.mjs',
    ['--source', backup, '--confirm'],
    { SASHA_DB_PATH: restored }
  );

  const verification = createAppDatabase(restored, { dataProtection });
  try {
    assert.deepEqual(verification.verifyIntegrity(), ['ok']);
    assert.equal(
      verification.getOrganizationCustomer('org-drill', 'customer-drill').phone,
      '0912-345-678'
    );
  } finally {
    verification.close();
  }

  console.log(JSON.stringify({
    status: 'ok',
    encryptedBackup: backups[0],
    restoredCustomer: 'customer-drill'
  }, null, 2));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
