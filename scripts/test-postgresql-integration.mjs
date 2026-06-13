import { randomUUID } from 'node:crypto';

import { createDataProtectionService } from '../api/data-protection.mjs';
import { createPostgresqlDatabase } from '../api/postgresql-database.mjs';
import { runPostgresqlMigrations } from '../database/migrate-postgresql.mjs';

const connectionString = String(process.env.SASHA_TEST_DATABASE_URL || '').trim();
if (!connectionString) {
  throw new Error('SASHA_TEST_DATABASE_URL is required for the PostgreSQL integration test.');
}

let postgres;
try {
  postgres = await import('pg');
} catch (error) {
  throw new Error('Run npm ci before the PostgreSQL integration test.', { cause: error });
}

const Pool = postgres.Pool || postgres.default?.Pool;
const schema = `sasha_test_${randomUUID().replaceAll('-', '')}`;
const sslMode = String(process.env.SASHA_TEST_DATABASE_SSL || 'disable').toLowerCase();
const ssl = sslMode === 'disable'
  ? false
  : { rejectUnauthorized: sslMode === 'verify-full' };
const admin = new Pool({ connectionString, max: 2, ssl });
let pool;

try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  pool = new Pool({
    connectionString,
    max: 4,
    options: `-c search_path=${schema}`,
    ssl
  });
  await runPostgresqlMigrations(pool);
  const integrationKeys = {
    'integration-v1': Buffer.alloc(32, 17),
    'integration-v2': Buffer.alloc(32, 18)
  };
  const dataProtection = createDataProtectionService({
    currentKeyId: 'integration-v1',
    keys: integrationKeys
  });
  const database = createPostgresqlDatabase(pool, { dataProtection });
  await database.createOrganizationOwner({
    organizationId: 'org-integration',
    organizationName: 'PostgreSQL Integration',
    userId: 'user-owner',
    displayName: '張經理',
    username: `integration-${Date.now()}`,
    passwordHash: 'test-hash',
    passwordSalt: 'test-salt'
  });
  await database.createOrganizationCustomer(
    'org-integration',
    'user-owner',
    {
      id: 'customer-integration',
      name: '測試客戶',
      phone: '0912-345-678',
      email: 'integration@example.com',
      birthday: '1980-01-01',
      ownerUserId: 'user-owner',
      owner: '張經理',
      stage: '新名單',
      nextFollowUp: '',
      needs: '測試需求',
      note: '測試備註'
    }
  );
  const raw = await pool.query(
    'SELECT name, phone, email, birthday, needs, note FROM customers WHERE id = $1',
    ['customer-integration']
  );
  for (const value of Object.values(raw.rows[0])) {
    if (!String(value).startsWith('enc.v1.')) {
      throw new Error('PostgreSQL sensitive field was not encrypted at rest.');
    }
  }
  const returned = await database.getOrganizationCustomer(
    'org-integration',
    'customer-integration'
  );
  if (returned.phone !== '0912-345-678') {
    throw new Error('PostgreSQL encrypted field could not be decrypted.');
  }
  await database.createOrganizationAttachment(
    'org-integration',
    'user-owner',
    {
      id: 'attachment-integration',
      customerId: 'customer-integration',
      policyId: null,
      originalName: 'integration-policy.jpg',
      mediaType: 'image/jpeg',
      sizeBytes: 128,
      sha256: 'integration-sha256',
      status: 'clean',
      storageKey: 'org-integration/clean/attachment-integration.sasha',
      scanDetail: 'integration-test',
      scannedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  );
  const rawAttachment = await pool.query(
    'SELECT original_name FROM attachments WHERE id = $1',
    ['attachment-integration']
  );
  if (!String(rawAttachment.rows[0].original_name).startsWith('enc.v1.')) {
    throw new Error('PostgreSQL attachment filename was not encrypted at rest.');
  }

  const rotatedProtection = createDataProtectionService({
    currentKeyId: 'integration-v2',
    keys: integrationKeys
  });
  const rotatedDatabase = createPostgresqlDatabase(pool, {
    dataProtection: rotatedProtection
  });
  await rotatedDatabase.protectSensitiveData();
  const protectionStatus = await rotatedDatabase.dataProtectionStatus();
  const oldKeyValues = Object.entries(protectionStatus.byKeyId)
    .filter(([keyId]) => keyId !== protectionStatus.currentKeyId)
    .reduce((total, [, count]) => total + count, 0);
  if (protectionStatus.plaintextValues || oldKeyValues) {
    throw new Error('PostgreSQL key rotation left plaintext or old-key values.');
  }
  const rotatedCustomer = await rotatedDatabase.getOrganizationCustomer(
    'org-integration',
    'customer-integration'
  );
  if (rotatedCustomer.phone !== '0912-345-678') {
    throw new Error('PostgreSQL rotated field could not be decrypted.');
  }

  await rotatedDatabase.close();
  pool = null;
  console.log(JSON.stringify({
    status: 'ok',
    migrationSchema: schema,
    encryptedFieldsVerified: [
      ...Object.keys(raw.rows[0]),
      'attachment.original_name'
    ],
    keyRotation: protectionStatus
  }, null, 2));
} finally {
  if (pool) await pool.end().catch(() => {});
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
  await admin.end();
}
