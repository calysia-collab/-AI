import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppDatabase } from '../api/database.mjs';
import { createDataProtectionService } from '../api/data-protection.mjs';
import { createImportJobService } from '../api/import-job-service.mjs';
import { createOcrService } from '../api/ocr-service.mjs';
import { parseTabularImport } from '../api/tabular-import.mjs';

function dataProtection() {
  return createDataProtectionService({
    currentKeyId: 'workflow-v1',
    keys: { 'workflow-v1': Buffer.alloc(32, 42) }
  });
}

function createDatabase() {
  const database = createAppDatabase(':memory:', {
    dataProtection: dataProtection()
  });
  database.createOrganizationOwner({
    organizationId: 'org-workflows',
    organizationName: '莎莎保險助理工作台',
    userId: 'user-owner',
    displayName: '張經理',
    username: 'zhang.manager',
    passwordHash: 'hash',
    passwordSalt: 'salt'
  });
  database.createOrganizationCustomer(
    'org-workflows',
    'user-owner',
    {
      id: 'customer-workflow',
      name: '王大明',
      phone: '0912-345-678',
      email: 'wang@example.com',
      ownerUserId: 'user-owner',
      owner: '張經理',
      stage: '需求訪談',
      needs: '家庭保障'
    }
  );
  return database;
}

async function waitFor(predicate, timeout = 4_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for workflow state.');
}

test('customer 360 records persist with optimistic versions and encrypted search', async () => {
  const database = createDatabase();
  try {
    const created = await database.createCustomerWorkspaceRecord(
      'contacts',
      'org-workflows',
      'user-owner',
      'customer-workflow',
      {
        contactType: 'phone',
        label: '主要手機',
        value: '0912-345-678',
        isPrimary: true
      }
    );
    assert.equal(created.item.version, 1);
    assert.equal(created.item.value, '0912-345-678');

    const updated = await database.updateCustomerWorkspaceRecord(
      'contacts',
      'org-workflows',
      'user-owner',
      'customer-workflow',
      created.item.id,
      {
        contactType: 'phone',
        label: '私人手機',
        value: '0988-000-111',
        isPrimary: true
      },
      1
    );
    assert.equal(updated.item.version, 2);
    assert.equal(updated.item.label, '私人手機');

    const workspace = await database.getCustomerWorkspace(
      'org-workflows',
      'customer-workflow'
    );
    assert.equal(workspace.contacts.length, 1);
    assert.equal(workspace.contacts[0].value, '0988-000-111');

    const results = await database.searchOrganization(
      'org-workflows',
      '王大明'
    );
    assert.equal(results[0].type, 'customer');
    assert.equal(results[0].id, 'customer-workflow');
  } finally {
    database.close();
  }
});

test('CSV import runs in the background and records row errors', async () => {
  const database = createDatabase();
  try {
    const rows = parseTabularImport(Buffer.from(
      '客戶姓名,手機,服務階段\n陳美玲,0911000000,新名單\n,0922000000,需求訪談\n',
      'utf8'
    ), 'csv');
    assert.equal(rows.length, 2);
    const service = createImportJobService(database);
    const job = await service.create({
      organizationId: 'org-workflows',
      actorUserId: 'user-owner',
      fileName: 'customers.csv',
      format: 'csv',
      buffer: Buffer.from(
        '客戶姓名,手機,服務階段\n陳美玲,0911000000,新名單\n,0922000000,需求訪談\n',
        'utf8'
      ),
      defaultOwnerUserId: 'user-owner',
      defaultOwner: '張經理'
    });
    const completed = await waitFor(async () => {
      const current = await database.getImportJob('org-workflows', job.id);
      return ['completed', 'completed_with_errors', 'failed'].includes(current.status)
        ? current
        : null;
    });
    assert.equal(completed.status, 'completed_with_errors');
    assert.equal(completed.imported, 1);
    assert.equal(completed.failed, 1);
    const payload = await database.getImportJobPayload('org-workflows', job.id);
    assert.match(payload.errorCsv, /客戶姓名為必填/);
  } finally {
    database.close();
  }
});

test('OCR workflow requires review, audits corrections, and creates a policy on approval', async () => {
  const database = createDatabase();
  try {
    database.createOrganizationAttachment(
      'org-workflows',
      'user-owner',
      {
        id: 'attachment-policy',
        customerId: 'customer-workflow',
        originalName: 'policy.jpg',
        mediaType: 'image/jpeg',
        sizeBytes: 4,
        sha256: 'test-sha',
        status: 'clean',
        storageKey: 'attachment-policy.bin',
        scanDetail: 'test-clean',
        scannedAt: new Date().toISOString()
      }
    );
    const service = createOcrService({
      database,
      attachmentStorage: {
        read: async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      },
      environment: {
        NODE_ENV: 'test',
        SASHA_OCR_PROVIDER: 'fixture'
      }
    });
    const created = await service.create({
      organizationId: 'org-workflows',
      actorUserId: 'user-owner',
      attachmentId: 'attachment-policy',
      customerId: 'customer-workflow'
    });
    const review = await waitFor(async () => {
      const current = await database.getOcrJob('org-workflows', created.id);
      return current.status === 'review_required' ? current : null;
    });
    const premium = review.fields.find((field) => field.name === 'premium');
    const corrected = await database.correctOcrField(
      'org-workflows',
      'user-owner',
      review.id,
      premium.id,
      '49,800',
      premium.version
    );
    assert.equal(
      corrected.item.fields.find((field) => field.name === 'premium').corrected,
      true
    );

    const approved = await service.approve({
      organizationId: 'org-workflows',
      actorUserId: 'user-owner',
      jobId: review.id
    });
    assert.equal(approved.item.status, 'approved');
    assert.equal(approved.policy.premium, '49,800');
    assert.equal(
      database.listOrganizationPolicies('org-workflows').length,
      1
    );
  } finally {
    database.close();
  }
});

test('pending import and OCR jobs resume after a service restart', async () => {
  const database = createDatabase();
  try {
    const importResult = await database.createImportJob(
      'org-workflows',
      'user-owner',
      {
        fileName: 'recovery.csv',
        format: 'csv',
        rows: [{
          id: 'customer-recovered-import',
          name: '重新啟動匯入客戶',
          phone: '0911222333',
          ownerUserId: 'user-owner',
          owner: '張經理',
          stage: '新名單',
          importRow: 2
        }]
      }
    );
    const importService = createImportJobService(database);
    assert.equal(await importService.resumePending(), 1);
    const completedImport = await waitFor(async () => {
      const current = await database.getImportJob(
        'org-workflows',
        importResult.item.id
      );
      return current.status === 'completed' ? current : null;
    });
    assert.equal(completedImport.imported, 1);

    database.createOrganizationAttachment(
      'org-workflows',
      'user-owner',
      {
        id: 'attachment-recovery',
        customerId: 'customer-workflow',
        originalName: 'recovery.jpg',
        mediaType: 'image/jpeg',
        sizeBytes: 4,
        sha256: 'recovery-sha',
        status: 'clean',
        storageKey: 'attachment-recovery.bin',
        scanDetail: 'test-clean',
        scannedAt: new Date().toISOString()
      }
    );
    const ocrResult = await database.createOcrJob(
      'org-workflows',
      'user-owner',
      {
        attachmentId: 'attachment-recovery',
        customerId: 'customer-workflow',
        provider: 'fixture'
      }
    );
    const ocrService = createOcrService({
      database,
      attachmentStorage: {
        read: async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      },
      environment: {
        NODE_ENV: 'test',
        SASHA_OCR_PROVIDER: 'fixture'
      }
    });
    assert.equal(await ocrService.resumePending(), 1);
    const recoveredOcr = await waitFor(async () => {
      const current = await database.getOcrJob('org-workflows', ocrResult.item.id);
      return current.status === 'review_required' ? current : null;
    });
    assert.ok(recoveredOcr.fields.length > 0);
  } finally {
    database.close();
  }
});
