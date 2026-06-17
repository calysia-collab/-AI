import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createAppDatabase } from '../api/database.mjs';
import { createDataProtectionService } from '../api/data-protection.mjs';

function sampleState() {
  return {
    customers: [{
      id: 'customer-1',
      name: '王大明',
      phone: '0912-000-000',
      email: '',
      birthday: '',
      owner: '張經理',
      stage: '需求訪談',
      nextFollowUp: '2026-06-15',
      needs: '家庭保障',
      note: '',
      createdAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z'
    }],
    policies: [{
      id: 'policy-1',
      customerId: 'customer-1',
      customer: '王大明',
      company: '示範人壽',
      policyNumber: 'P-001',
      type: '醫療險',
      startDate: '2026-01-01',
      paymentYears: '20 年',
      coverage: '2,000,000',
      premium: '48,600',
      summary: '保障摘要',
      updated: '2026/06/12',
      createdAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z'
    }],
    events: [{
      id: 'event-1',
      customerId: 'customer-1',
      title: '保障檢視',
      date: '2026-06-15',
      time: '10:00',
      category: 'meeting',
      reminder: '1 小時前',
      detail: '台北',
      note: ''
    }],
    teamMembers: [{
      id: 'member-1',
      name: '張經理',
      role: '團隊經理',
      specialty: '團隊經營',
      target: 10,
      closed: 5,
      owner: true
    }],
    teamTasks: [{
      id: 'task-1',
      title: '整理客戶名單',
      owner: '張經理',
      due: '6/20',
      done: false
    }],
    teamGoal: 10
  };
}

function testDataProtection() {
  return createDataProtectionService({
    currentKeyId: 'test-v1',
    keys: { 'test-v1': Buffer.alloc(32, 31) }
  });
}

test('persists and returns relational application state', () => {
  const database = createAppDatabase(':memory:');
  try {
    const result = database.replaceState(sampleState(), 0);
    assert.deepEqual(result, { conflict: false, revision: 1 });
    const state = database.getState();
    assert.equal(state.customers[0].name, '王大明');
    assert.equal(state.policies[0].customerId, 'customer-1');
    assert.equal(state.policies[0].policyNumber, 'P-001');
    assert.equal(state.events[0].customerId, 'customer-1');
    assert.equal(state.teamGoal, 10);
  } finally {
    database.close();
  }
});

test('encrypts sensitive records at rest and transparently decrypts them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sasha-encrypted-database-'));
  const filename = join(directory, 'encrypted.sqlite');
  const dataProtection = testDataProtection();
  try {
    const database = createAppDatabase(filename, { dataProtection });
    database.replaceState(sampleState(), 0);
    database.close();

    const rawDatabase = new DatabaseSync(filename, { readOnly: true });
    const rawCustomer = rawDatabase.prepare(
      'SELECT name, phone, email, birthday, needs, note FROM customers WHERE id = ?'
    ).get('customer-1');
    const rawPolicy = rawDatabase.prepare(
      'SELECT customer_name, policy_number, start_date, coverage, premium, summary FROM policies WHERE id = ?'
    ).get('policy-1');
    const rawEvent = rawDatabase.prepare(
      'SELECT title, detail, note FROM events WHERE id = ?'
    ).get('event-1');
    rawDatabase.close();
    for (const value of [
      ...Object.values(rawCustomer),
      ...Object.values(rawPolicy),
      ...Object.values(rawEvent)
    ]) {
      assert.match(String(value), /^enc\.v1\./);
    }

    const reopened = createAppDatabase(filename, { dataProtection });
    assert.equal(reopened.getCustomer('customer-1').phone, '0912-000-000');
    assert.equal(reopened.getPolicy('policy-1').policyNumber, 'P-001');
    assert.equal(reopened.getEvent('event-1').title, '保障檢視');
    assert.equal(reopened.dataProtectionStatus().plaintextValues, 0);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects stale whole-state revisions', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.replaceState(sampleState(), 0);
    assert.deepEqual(database.replaceState(sampleState(), 0), { conflict: true, revision: 1 });
  } finally {
    database.close();
  }
});

test('enforces policy-to-customer foreign keys', () => {
  const database = createAppDatabase(':memory:');
  const state = sampleState();
  state.policies[0].customerId = 'missing-customer';
  try {
    assert.throws(() => database.replaceState(state, 0), /FOREIGN KEY constraint failed/);
  } finally {
    database.close();
  }
});

test('supports individual event CRUD with optimistic version checks', () => {
  const database = createAppDatabase(':memory:');
  try {
    const customerResult = database.createCustomer(sampleState().customers[0]);
    assert.equal(customerResult.item.version, 1);

    const eventResult = database.createEvent(sampleState().events[0]);
    assert.equal(eventResult.item.version, 1);
    assert.equal(eventResult.item.status, 'scheduled');

    const updated = database.updateEvent('event-1', {
      ...eventResult.item,
      title: '已更新保障檢視',
      status: 'completed'
    }, 1);
    assert.equal(updated.item.version, 2);
    assert.equal(updated.item.title, '已更新保障檢視');
    assert.equal(updated.item.status, 'completed');

    const stale = database.updateEvent('event-1', {
      ...updated.item,
      title: '舊版本覆蓋'
    }, 1);
    assert.equal(stale.conflict, true);
    assert.equal(stale.item.version, 2);

    const deleted = database.deleteEvent('event-1', 2);
    assert.equal(deleted.deletedId, 'event-1');
    assert.equal(database.getEvent('event-1'), null);
  } finally {
    database.close();
  }
});

test('prevents customer deletion while policies still reference the customer', () => {
  const database = createAppDatabase(':memory:');
  try {
    const state = sampleState();
    database.createCustomer(state.customers[0]);
    database.createPolicy(state.policies[0]);
    assert.throws(() => database.deleteCustomer('customer-1', 1), /FOREIGN KEY constraint failed/);
    assert.equal(database.getCustomer('customer-1').name, '王大明');
  } finally {
    database.close();
  }
});

test('renaming a customer keeps denormalized policy display names consistent', () => {
  const database = createAppDatabase(':memory:');
  try {
    const state = sampleState();
    database.createCustomer(state.customers[0]);
    database.createPolicy(state.policies[0]);
    const updated = database.updateCustomer('customer-1', {
      ...state.customers[0],
      name: '王大明（更新）'
    }, 1);
    assert.equal(updated.item.version, 2);
    assert.equal(database.getPolicy('policy-1').customer, '王大明（更新）');
  } finally {
    database.close();
  }
});

test('records privacy-minimized audit events for mutations', () => {
  const database = createAppDatabase(':memory:');
  try {
    const state = sampleState();
    database.createCustomer(state.customers[0]);
    database.createEvent(state.events[0]);
    database.updateEvent('event-1', { ...state.events[0], status: 'completed' }, 1);
    const logs = database.listAuditLogs();
    assert.equal(logs.length, 3);
    assert.deepEqual(logs.map((log) => log.action), ['update', 'create', 'create']);
    assert.equal(logs[0].entityType, 'event');
    assert.doesNotMatch(JSON.stringify(logs), /0912-000-000|王大明/);
  } finally {
    database.close();
  }
});

test('creates a consistent database backup that passes integrity checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sasha-backup-test-'));
  const sourcePath = join(directory, 'source.sqlite');
  const backupPath = join(directory, 'backup.sqlite');
  const source = createAppDatabase(sourcePath);
  try {
    source.createCustomer(sampleState().customers[0]);
    source.backupTo(backupPath);
  } finally {
    source.close();
  }

  const backup = createAppDatabase(backupPath);
  try {
    assert.deepEqual(backup.verifyIntegrity(), ['ok']);
    assert.equal(backup.getCustomer('customer-1').name, '王大明');
  } finally {
    backup.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('isolates customers, policies, events, revisions, and audit logs by organization', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createOrganization({ id: 'org-a', name: 'Organization A' });
    database.createOrganization({ id: 'org-b', name: 'Organization B' });

    database.createOrganizationCustomer('org-a', 'user-a', {
      ...sampleState().customers[0],
      id: 'customer-a',
      name: 'Customer A'
    });
    database.createOrganizationCustomer('org-b', 'user-b', {
      ...sampleState().customers[0],
      id: 'customer-b',
      name: 'Customer B'
    });
    database.createOrganizationPolicy('org-a', 'user-a', {
      ...sampleState().policies[0],
      id: 'policy-a',
      customerId: 'customer-a',
      customer: 'Customer A'
    });
    database.createOrganizationEvent('org-b', 'user-b', {
      ...sampleState().events[0],
      id: 'event-b',
      customerId: 'customer-b'
    });
    assert.throws(() => database.createOrganizationPolicy('org-b', 'user-b', {
      ...sampleState().policies[0],
      id: 'cross-organization-policy',
      customerId: 'customer-a'
    }), /CUSTOMER_NOT_IN_ORGANIZATION/);

    assert.deepEqual(
      database.listOrganizationCustomers('org-a').map((item) => item.id),
      ['customer-a']
    );
    assert.deepEqual(
      database.listOrganizationCustomers('org-b').map((item) => item.id),
      ['customer-b']
    );
    assert.equal(database.getOrganizationCustomer('org-a', 'customer-b'), null);
    assert.equal(database.listOrganizationPolicies('org-b').length, 0);
    assert.equal(database.listOrganizationEvents('org-a').length, 0);
    assert.equal(database.getOrganizationRevision('org-a'), 2);
    assert.equal(database.getOrganizationRevision('org-b'), 2);
    assert.ok(database.listOrganizationAuditLogs('org-a').every(
      (log) => !JSON.stringify(log).includes('customer-b')
    ));
  } finally {
    database.close();
  }
});

test('limits advisors to customers and related records assigned to their account', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createOrganization({ id: 'org-scope', name: 'Scope Organization' });
    for (const [id, displayName] of [
      ['advisor-a', '顧問甲'],
      ['advisor-b', '顧問乙']
    ]) {
      database.createOrganizationUser('org-scope', null, {
        id,
        displayName,
        username: id,
        role: 'advisor',
        passwordHash: 'hash',
        passwordSalt: 'salt'
      });
    }

    database.createOrganizationCustomer('org-scope', 'advisor-a', {
      ...sampleState().customers[0],
      id: 'customer-a',
      name: '甲的客戶',
      ownerUserId: 'advisor-a'
    }, 'advisor-a');
    database.createOrganizationCustomer('org-scope', 'advisor-b', {
      ...sampleState().customers[0],
      id: 'customer-b',
      name: '乙的客戶',
      ownerUserId: 'advisor-b'
    }, 'advisor-b');
    database.createOrganizationPolicy('org-scope', 'advisor-a', {
      ...sampleState().policies[0],
      id: 'policy-a',
      customerId: 'customer-a',
      customer: '甲的客戶'
    }, 'advisor-a');
    database.createOrganizationPolicy('org-scope', 'advisor-b', {
      ...sampleState().policies[0],
      id: 'policy-b',
      customerId: 'customer-b',
      customer: '乙的客戶'
    }, 'advisor-b');
    database.createOrganizationEvent('org-scope', 'advisor-a', {
      ...sampleState().events[0],
      id: 'event-a',
      customerId: 'customer-a'
    }, 'advisor-a');
    database.createOrganizationEvent('org-scope', null, {
      ...sampleState().events[0],
      id: 'event-team',
      customerId: '',
      category: 'team'
    });

    const scopedState = database.getOrganizationState('org-scope', 'advisor-a');
    assert.deepEqual(scopedState.customers.map((item) => item.id), ['customer-a']);
    assert.deepEqual(scopedState.policies.map((item) => item.id), ['policy-a']);
    assert.deepEqual(
      scopedState.events.map((item) => item.id).sort(),
      ['event-a', 'event-team']
    );
    assert.equal(
      database.getOrganizationCustomer('org-scope', 'customer-b', 'advisor-a'),
      null
    );
    assert.equal(database.updateOrganizationCustomer(
      'org-scope',
      'advisor-a',
      'customer-b',
      {
        ...sampleState().customers[0],
        ownerUserId: 'advisor-a'
      },
      1,
      'advisor-a'
    ).notFound, true);
    assert.throws(() => database.createOrganizationCustomer(
      'org-scope',
      'advisor-a',
      {
        ...sampleState().customers[0],
        id: 'wrong-owner',
        ownerUserId: 'advisor-b'
      },
      'advisor-a'
    ), /CUSTOMER_ACCESS_DENIED/);
    assert.throws(() => database.createOrganizationPolicy(
      'org-scope',
      'advisor-a',
      {
        ...sampleState().policies[0],
        id: 'forbidden-policy',
        customerId: 'customer-b'
      },
      'advisor-a'
    ), /CUSTOMER_ACCESS_DENIED/);

    database.updateOrganizationUser('org-scope', null, 'advisor-a', {
      displayName: '顧問甲改名',
      role: 'advisor',
      active: true
    });
    assert.equal(
      database.getOrganizationCustomer('org-scope', 'customer-a').owner,
      '顧問甲改名'
    );
  } finally {
    database.close();
  }
});

test('supports phase 2 cursor pages and reversible archives', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createOrganization({ id: 'org-phase2', name: 'Phase 2 Organization' });
    for (const id of ['customer-page-a', 'customer-page-b', 'customer-page-c']) {
      database.createOrganizationCustomer('org-phase2', 'manager-phase2', {
        ...sampleState().customers[0],
        id,
        name: id
      });
    }

    const firstPage = database.listOrganizationResourcePage(
      'customers',
      'org-phase2',
      null,
      { limit: 2 }
    );
    assert.equal(firstPage.items.length, 2);
    assert.equal(firstPage.hasMore, true);

    const secondPage = database.listOrganizationResourcePage(
      'customers',
      'org-phase2',
      null,
      {
        cursor: {
          id: firstPage.items.at(-1).id,
          updatedAt: firstPage.items.at(-1).updatedAt
        },
        limit: 2
      }
    );
    assert.equal(secondPage.items.length, 1);
    assert.equal(secondPage.hasMore, false);

    const archived = database.setOrganizationResourceArchived(
      'customers',
      'org-phase2',
      'manager-phase2',
      'customer-page-a',
      1,
      true
    );
    assert.equal(archived.item.version, 2);
    assert.equal(
      database.listOrganizationCustomers('org-phase2')
        .some((item) => item.id === 'customer-page-a'),
      false
    );
    assert.deepEqual(
      database.listOrganizationResourcePage(
        'customers',
        'org-phase2',
        null,
        { archived: 'only' }
      ).items.map((item) => item.id),
      ['customer-page-a']
    );

    const restored = database.setOrganizationResourceArchived(
      'customers',
      'org-phase2',
      'manager-phase2',
      'customer-page-a',
      2,
      false
    );
    assert.equal(restored.item.version, 3);
    assert.equal(
      database.listOrganizationCustomers('org-phase2')
        .some((item) => item.id === 'customer-page-a'),
      true
    );
    assert.deepEqual(
      database.listOrganizationAuditLogs('org-phase2', 2).map((item) => item.action),
      ['restore', 'archive']
    );
  } finally {
    database.close();
  }
});

test('claims legacy unscoped data for the first owner organization', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createCustomer(sampleState().customers[0]);
    assert.equal(database.listOrganizationCustomers('org-owner').length, 0);

    database.createOrganizationOwner({
      organizationId: 'org-owner',
      organizationName: '莎莎保險助理工作台',
      userId: 'user-owner',
      displayName: '張經理',
      username: 'zhang.manager',
      passwordHash: 'hash',
      passwordSalt: 'salt'
    });

    assert.equal(database.listOrganizationCustomers('org-owner').length, 1);
    assert.equal(
      database.listOrganizationCustomers('org-owner')[0].id,
      sampleState().customers[0].id
    );
  } finally {
    database.close();
  }
});

test('claims legacy data on restart when a single organization already exists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sasha-migration-test-'));
  const databasePath = join(directory, 'migration.sqlite');
  let database = createAppDatabase(databasePath);
  database.createOrganizationOwner({
    organizationId: 'org-existing',
    organizationName: 'Existing Organization',
    userId: 'user-existing',
    displayName: 'Existing Owner',
    username: 'existing.owner',
    passwordHash: 'hash',
    passwordSalt: 'salt'
  });
  database.createCustomer({
    ...sampleState().customers[0],
    id: 'legacy-after-owner'
  });
  database.close();

  database = createAppDatabase(databasePath);
  try {
    assert.equal(
      database.getOrganizationCustomer('org-existing', 'legacy-after-owner')?.id,
      'legacy-after-owner'
    );
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('stores MFA secrets securely and prevents code replay', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createOrganizationOwner({
      organizationId: 'org-mfa',
      organizationName: 'MFA Organization',
      userId: 'user-mfa',
      displayName: 'MFA Owner',
      username: 'mfa.owner',
      passwordHash: 'hash',
      passwordSalt: 'salt'
    });

    assert.equal(database.setOrganizationUserMfaPending(
      'wrong-organization',
      'user-mfa',
      'encrypted-secret',
      ['recovery-hash-1']
    ).notFound, true);
    database.setOrganizationUserMfaPending(
      'org-mfa',
      'user-mfa',
      'encrypted-secret',
      ['recovery-hash-1', 'recovery-hash-2']
    );
    assert.equal(database.getUserById('user-mfa').mfaSecretCiphertext, 'encrypted-secret');
    assert.equal(database.getUserById('user-mfa').mfaEnabled, false);

    database.enableOrganizationUserMfa('org-mfa', 'user-mfa', 100);
    assert.equal(database.getUserById('user-mfa').mfaEnabled, true);
    assert.equal(database.consumeUserTotpCounter('user-mfa', 100), false);
    assert.equal(database.consumeUserTotpCounter('user-mfa', 101), true);
    assert.equal(database.consumeUserTotpCounter('user-mfa', 101), false);
    assert.equal(database.consumeUserRecoveryCode('user-mfa', 'recovery-hash-1'), true);
    assert.equal(database.consumeUserRecoveryCode('user-mfa', 'recovery-hash-1'), false);

    database.disableOrganizationUserMfa('org-mfa', 'user-mfa');
    assert.equal(database.getUserById('user-mfa').mfaEnabled, false);
    assert.equal(database.getUserById('user-mfa').mfaSecretCiphertext, null);
    assert.equal(database.consumeUserRecoveryCode('user-mfa', 'recovery-hash-2'), false);
  } finally {
    database.close();
  }
});

test('exports a complete PostgreSQL migration snapshot without active sessions', () => {
  const database = createAppDatabase(':memory:');
  try {
    database.createOrganizationOwner({
      organizationId: 'org-export',
      organizationName: 'Export Organization',
      userId: 'user-export',
      displayName: 'Export Owner',
      username: 'export.owner',
      passwordHash: 'hash',
      passwordSalt: 'salt'
    });
    database.replaceOrganizationState('org-export', 'user-export', sampleState(), 0);
    database.createSession({
      tokenHash: 'session-hash',
      userId: 'user-export',
      csrfToken: 'csrf',
      createdAt: '2026-06-12T00:00:00.000Z',
      lastSeenAt: '2026-06-12T00:00:00.000Z',
      expiresAt: '2026-06-13T00:00:00.000Z'
    });

    const snapshot = database.exportPostgresqlSnapshot();
    assert.equal(snapshot.format, 'sasha-postgresql-migration-v1');
    assert.equal(snapshot.counts.organizations, 1);
    assert.equal(snapshot.counts.users, 1);
    assert.equal(snapshot.counts.customers, 1);
    assert.equal(snapshot.counts.policies, 1);
    assert.equal(snapshot.counts.events, 1);
    assert.equal('sessions' in snapshot, false);
    assert.equal(snapshot.users[0].password_hash, 'hash');
  } finally {
    database.close();
  }
});
