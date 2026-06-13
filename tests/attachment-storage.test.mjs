import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAttachmentStorage } from '../api/attachment-storage.mjs';
import { createDataProtectionService } from '../api/data-protection.mjs';

const tinyJpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02,
  0xff, 0xd9
]);

function protection() {
  return createDataProtectionService({
    currentKeyId: 'test-v1',
    keys: { 'test-v1': Buffer.alloc(32, 4) }
  });
}

function rotatingProtection(currentKeyId) {
  return createDataProtectionService({
    currentKeyId,
    keys: {
      'test-v1': Buffer.alloc(32, 4),
      'test-v2': Buffer.alloc(32, 5)
    }
  });
}

test('sanitizes, scans, encrypts, and reads a clean policy image', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sasha-attachments-'));
  const storage = createAttachmentStorage({
    root,
    dataProtection: protection(),
    scanner: async () => ({ status: 'clean', detail: 'test-scanner' })
  });
  try {
    const item = await storage.store({
      attachmentId: 'attachment-1',
      organizationId: 'org-1',
      originalName: '../../policy.jpg',
      buffer: tinyJpeg
    });
    assert.equal(item.status, 'clean');
    assert.equal(item.originalName, 'policy.jpg');
    const body = await storage.read({ ...item, organizationId: 'org-1' });
    assert.equal(body.includes(Buffer.from('Exif')), false);
    const token = storage.createDownloadToken({ ...item, organizationId: 'org-1' });
    assert.ok(storage.verifyDownloadToken(token, { ...item, organizationId: 'org-1' }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('keeps files quarantined when no malware scanner is available', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sasha-attachments-'));
  const storage = createAttachmentStorage({
    root,
    dataProtection: protection()
  });
  try {
    const item = await storage.store({
      attachmentId: 'attachment-2',
      organizationId: 'org-1',
      originalName: 'policy.jpg',
      buffer: tinyJpeg
    });
    assert.equal(item.status, 'quarantined');
    await assert.rejects(storage.read({ ...item, organizationId: 'org-1' }), /NOT_CLEAN/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rotates an encrypted attachment file to the active key', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sasha-attachments-'));
  const oldStorage = createAttachmentStorage({
    root,
    dataProtection: rotatingProtection('test-v1'),
    scanner: async () => ({ status: 'clean', detail: 'test-scanner' })
  });
  try {
    const item = {
      ...await oldStorage.store({
        attachmentId: 'attachment-rotation',
        organizationId: 'org-1',
        originalName: 'policy.jpg',
        buffer: tinyJpeg
      }),
      organizationId: 'org-1'
    };
    const currentStorage = createAttachmentStorage({
      root,
      dataProtection: rotatingProtection('test-v2'),
      scanner: async () => ({ status: 'clean', detail: 'test-scanner' })
    });
    assert.deepEqual(
      await currentStorage.protectionStatus([item]),
      {
        currentKeyId: 'test-v2',
        currentFiles: 0,
        oldKeyFiles: 1,
        plaintextFiles: 0,
        missingFiles: 0
      }
    );
    assert.equal(await currentStorage.rotate(item), true);
    assert.equal(await currentStorage.rotate(item), false);
    assert.equal((await currentStorage.protectionStatus([item])).currentFiles, 1);
    assert.equal((await currentStorage.read(item)).includes(Buffer.from('Exif')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
