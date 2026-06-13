import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createConfiguredDatabase } from '../api/database-factory.mjs';
import { createAppDatabase } from '../api/database.mjs';
import { createApiHandler } from '../api/handler.mjs';
import { createPostgresqlDatabase } from '../api/postgresql-database.mjs';
import { createSecurityService } from '../api/security.mjs';
import { runPostgresqlMigrations } from '../database/migrate-postgresql.mjs';

function migrationPool() {
  const applied = new Map();
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (/SELECT checksum FROM schema_migrations/.test(sql)) {
        return { rows: applied.has(values[0]) ? [{ checksum: applied.get(values[0]) }] : [] };
      }
      if (/INSERT INTO schema_migrations/.test(sql)) {
        applied.set(values[0], values[1]);
      }
      return { rows: [] };
    },
    release() {}
  };
  return {
    applied,
    queries,
    async connect() {
      return client;
    },
    async end() {},
    async query() {
      return { rows: [{ '?column?': 1 }] };
    }
  };
}

test('PostgreSQL migrations are locked, idempotent, and checksum protected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sasha-pg-migrations-'));
  await mkdir(join(directory, 'migrations'));
  await writeFile(join(directory, 'migrations', '001_initial_schema.sql'), 'SELECT 1;\n');
  await writeFile(join(directory, 'migrations', '002_extra.sql'), 'SELECT 2;\n');
  const pool = migrationPool();
  try {
    assert.deepEqual(await runPostgresqlMigrations(pool, { directory }), [
      '001_initial_schema.sql',
      '002_extra.sql'
    ]);
    assert.deepEqual(await runPostgresqlMigrations(pool, { directory }), []);
    assert.ok(pool.queries.some(({ sql }) => /pg_advisory_lock/.test(sql)));

    await writeFile(join(directory, 'migrations', '002_extra.sql'), 'SELECT 3;\n');
    await assert.rejects(
      runPostgresqlMigrations(pool, { directory }),
      /checksum mismatch/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('database factory keeps SQLite as the local default', async () => {
  const database = await createConfiguredDatabase({
    environment: { SASHA_DB_PATH: ':memory:' },
    root: process.cwd()
  });
  try {
    assert.equal(database.engine, 'sqlite');
    assert.equal(await database.getRevision(), 0);
  } finally {
    await database.close();
  }
});

test('database factory configures PostgreSQL SSL and pool size', async () => {
  let receivedConfig;
  const pool = migrationPool();
  const database = await createConfiguredDatabase({
    environment: {
      SASHA_DATABASE_URL: 'postgresql://example.invalid/sasha',
      SASHA_DATABASE_SSL: 'verify-full',
      SASHA_DATABASE_POOL_SIZE: '14'
    },
    root: process.cwd(),
    poolFactory: async (config) => {
      receivedConfig = config;
      return pool;
    }
  });
  try {
    assert.equal(database.engine, 'postgresql');
    assert.equal(receivedConfig.max, 14);
    assert.deepEqual(receivedConfig.ssl, { rejectUnauthorized: true });
  } finally {
    await database.close();
  }
});

test('PostgreSQL repository maps rows to the existing API contract', async () => {
  const pool = {
    async query(sql) {
      if (/FROM app_meta/.test(sql)) return { rows: [{ value: '7' }] };
      if (/INSERT INTO organization_revisions/.test(sql)) return { rows: [] };
      if (/SELECT revision FROM organization_revisions/.test(sql)) {
        return { rows: [{ revision: '3' }] };
      }
      if (/FROM customers/.test(sql)) {
        return {
          rows: [{
            id: 'customer-1',
            name: '王大明',
            phone: '0912',
            email: '',
            birthday: '1980-01-02',
            owner_user_id: 'user-owner',
            owner: '張經理',
            stage: '需求訪談',
            next_follow_up: '2026-06-20',
            needs: '家庭保障',
            note: '',
            created_at: new Date('2026-06-12T00:00:00.000Z'),
            updated_at: new Date('2026-06-12T01:00:00.000Z'),
            version: '2'
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async end() {}
  };
  const database = createPostgresqlDatabase(pool);
  assert.equal(await database.getRevision(), 7);
  assert.equal(await database.getOrganizationRevision('org-1'), 3);
  assert.deepEqual(await database.listOrganizationCustomers('org-1'), [{
    id: 'customer-1',
    name: '王大明',
    phone: '0912',
    email: '',
    birthday: '1980-01-02',
    ownerUserId: 'user-owner',
    owner: '張經理',
    stage: '需求訪談',
    nextFollowUp: '2026-06-20',
    needs: '家庭保障',
    note: '',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T01:00:00.000Z',
    version: 2
  }]);
});

test('PostgreSQL repository applies advisor ownership filters to related records', async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
    async end() {}
  };
  const database = createPostgresqlDatabase(pool);

  await database.listOrganizationCustomers('org-1', 'advisor-1');
  await database.listOrganizationPolicies('org-1', 'advisor-1');
  await database.listOrganizationEvents('org-1', 'advisor-1');

  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /owner_user_id = \$2/);
  assert.match(calls[1].sql, /JOIN customers/);
  assert.match(calls[1].sql, /customers\.owner_user_id = \$2/);
  assert.match(calls[2].sql, /events\.category = 'team'/);
  assert.deepEqual(calls.map((call) => call.values), [
    ['org-1', 'advisor-1'],
    ['org-1', 'advisor-1'],
    ['org-1', 'advisor-1']
  ]);
});

test('PostgreSQL snapshot import requires an empty target and verifies every count', async () => {
  const counts = new Map();
  const client = {
    async query(sql) {
      const countMatch = sql.match(/SELECT count\(\*\)::bigint AS count FROM (\w+)/i);
      if (countMatch) {
        return { rows: [{ count: String(counts.get(countMatch[1]) || 0) }] };
      }
      const insertMatch = sql.match(/INSERT INTO\s+(\w+)/i);
      if (insertMatch && insertMatch[1] !== 'app_meta') {
        counts.set(insertMatch[1], (counts.get(insertMatch[1]) || 0) + 1);
      }
      return { rows: [] };
    },
    release() {}
  };
  const pool = {
    async connect() {
      return client;
    },
    async end() {}
  };
  const database = createPostgresqlDatabase(pool);
  const snapshot = {
    format: 'sasha-postgresql-migration-v1',
    appRevision: 0,
    organizations: [{ id: 'org-1', name: 'Organization', created_at: '2026-06-12T00:00:00Z' }],
    users: [{
      id: 'user-1',
      organization_id: 'org-1',
      display_name: 'Owner',
      username: 'owner',
      password_hash: 'hash',
      password_salt: 'salt',
      role: 'owner',
      active: 1,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      mfa_secret_ciphertext: null,
      mfa_enabled: 0,
      mfa_last_counter: null,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }],
    recoveryCodes: [],
    customers: [],
    policies: [],
    events: [],
    teamMembers: [],
    teamTasks: [],
    organizationSettings: [],
    organizationRevisions: [{ organization_id: 'org-1', revision: 0 }],
    auditLogs: [],
    attachments: []
  };
  const result = await database.importPostgresqlSnapshot(snapshot);
  assert.equal(result.counts.organizations, 1);
  assert.equal(result.counts.users, 1);
  assert.equal(result.counts.organizationRevisions, 1);
  assert.equal(result.sessionsMigrated, false);

  await assert.rejects(
    database.importPostgresqlSnapshot(snapshot),
    /POSTGRESQL_TARGET_NOT_EMPTY/
  );
});

test('the HTTP API accepts a fully asynchronous database implementation', async () => {
  const sqlite = createAppDatabase(':memory:');
  const database = new Proxy(sqlite, {
    get(target, property) {
      const value = target[property];
      return typeof value === 'function'
        ? async (...args) => value.apply(target, args)
        : value;
    }
  });
  const handler = createApiHandler(database, {}, {
    security: createSecurityService(Buffer.alloc(32, 29))
  });
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    await handler(request, response, pathname);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const setupResponse = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Async Organization',
        displayName: '張經理',
        username: 'async.owner',
        password: 'AsyncOwner2026!'
      })
    });
    const setup = await setupResponse.json();
    assert.equal(setupResponse.status, 201);

    const stateResponse = await fetch(`${baseUrl}/api/state`, {
      headers: {
        Cookie: String(setupResponse.headers.get('set-cookie')).split(';')[0]
      }
    });
    assert.equal(stateResponse.status, 200);
    assert.equal((await stateResponse.json()).revision, 0);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    sqlite.close();
  }
});
