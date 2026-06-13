import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAttachmentStorage } from '../api/attachment-storage.mjs';
import { createAppDatabase } from '../api/database.mjs';
import { createDataProtectionService } from '../api/data-protection.mjs';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sasha-key-rotation-'));
const databasePath = join(temporaryDirectory, 'rotation.sqlite');
const attachmentRoot = join(temporaryDirectory, 'attachments');
const keys = {
  'rotation-v1': Buffer.alloc(32, 41),
  'rotation-v2': Buffer.alloc(32, 42)
};
const tinyJpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02,
  0xff, 0xd9
]);

function protection(currentKeyId) {
  return createDataProtectionService({ currentKeyId, keys });
}

try {
  const oldProtection = protection('rotation-v1');
  const oldStorage = createAttachmentStorage({
    root: attachmentRoot,
    dataProtection: oldProtection,
    scanner: async () => ({ status: 'clean', detail: 'rotation-drill' })
  });
  const oldDatabase = createAppDatabase(databasePath, { dataProtection: oldProtection });
  let attachment;
  try {
    oldDatabase.createOrganizationOwner({
      organizationId: 'org-rotation',
      organizationName: 'Sasha Rotation Drill',
      userId: 'user-rotation',
      displayName: 'Manager Zhang',
      username: 'rotation.drill',
      passwordHash: 'test-hash',
      passwordSalt: 'test-salt'
    });
    oldDatabase.createOrganizationCustomer('org-rotation', 'user-rotation', {
      id: 'customer-rotation',
      name: 'Rotation Customer',
      phone: '0912-345-678',
      email: 'rotation@example.com',
      birthday: '1980-01-01',
      ownerUserId: 'user-rotation',
      owner: 'Manager Zhang',
      stage: 'active',
      nextFollowUp: '',
      needs: 'Key rotation',
      note: 'Old key data'
    });
    const stored = await oldStorage.store({
      attachmentId: 'attachment-rotation-drill',
      organizationId: 'org-rotation',
      originalName: 'old-key-policy.jpg',
      buffer: tinyJpeg
    });
    attachment = oldDatabase.createOrganizationAttachment(
      'org-rotation',
      'user-rotation',
      { ...stored, customerId: 'customer-rotation' }
    ).item;
  } finally {
    oldDatabase.close();
  }

  const currentProtection = protection('rotation-v2');
  const currentDatabase = createAppDatabase(databasePath, {
    dataProtection: currentProtection
  });
  const currentStorage = createAttachmentStorage({
    root: attachmentRoot,
    dataProtection: currentProtection,
    scanner: async () => ({ status: 'clean', detail: 'rotation-drill' })
  });
  try {
    assert.equal((await currentStorage.protectionStatus([attachment])).oldKeyFiles, 1);
    assert.equal(await currentStorage.rotate(attachment), true);
    const databaseStatus = currentDatabase.dataProtectionStatus();
    const attachmentStatus = await currentStorage.protectionStatus(
      currentDatabase.listAttachmentsForMaintenance()
    );
    assert.equal(databaseStatus.plaintextValues, 0);
    assert.deepEqual(Object.keys(databaseStatus.byKeyId), ['rotation-v2']);
    assert.equal(attachmentStatus.currentFiles, 1);
    assert.equal(attachmentStatus.oldKeyFiles, 0);
    assert.equal(
      currentDatabase.getOrganizationCustomer(
        'org-rotation',
        'customer-rotation'
      ).phone,
      '0912-345-678'
    );
    console.log(JSON.stringify({
      status: 'ok',
      databaseStatus,
      attachmentStatus
    }, null, 2));
  } finally {
    currentDatabase.close();
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
