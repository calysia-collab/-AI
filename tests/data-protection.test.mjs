import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDataProtectionService,
  loadDataProtectionConfig
} from '../api/data-protection.mjs';

function service(currentKeyId = 'key-2') {
  return createDataProtectionService({
    currentKeyId,
    keys: {
      'key-1': Buffer.alloc(32, 1),
      'key-2': Buffer.alloc(32, 2)
    }
  });
}

test('protects text with authenticated context and supports key rotation', () => {
  const context = {
    organizationId: 'org-1',
    entityType: 'customer',
    entityId: 'customer-1',
    field: 'phone'
  };
  const oldService = service('key-1');
  const value = oldService.protectText('0912-345-678', context);
  const currentService = service('key-2');
  assert.equal(currentService.unprotectText(value, context), '0912-345-678');
  assert.equal(currentService.needsRotation(value), true);
  assert.throws(() => currentService.unprotectText(value, { ...context, entityId: 'customer-2' }));
});

test('protects binary attachments and rejects a different context', () => {
  const protection = service();
  const context = {
    organizationId: 'org-1',
    entityType: 'attachment',
    entityId: 'attachment-1',
    field: 'content'
  };
  const encrypted = protection.protectBuffer(Buffer.from('private policy image'), context);
  assert.equal(protection.unprotectBuffer(encrypted, context).toString(), 'private policy image');
  assert.equal(protection.getProtectedBufferKeyId(encrypted), 'key-2');
  assert.equal(protection.needsBufferRotation(encrypted), false);
  assert.throws(() => protection.unprotectBuffer(encrypted, { ...context, organizationId: 'org-2' }));
});

test('creates short-lived scoped download tokens', () => {
  const protection = service();
  const token = protection.createScopedToken({
    attachmentId: 'attachment-1',
    organizationId: 'org-1',
    purpose: 'attachment-download'
  }, 60_000);
  assert.ok(protection.verifyScopedToken(token, {
    attachmentId: 'attachment-1',
    organizationId: 'org-1',
    purpose: 'attachment-download'
  }));
  assert.equal(protection.verifyScopedToken(token, { attachmentId: 'attachment-2' }), null);
});

test('loads a keyring from environment and falls back to the master key', () => {
  const fallback = loadDataProtectionConfig({}, Buffer.alloc(32, 9));
  assert.equal(fallback.currentKeyId, 'local-v1');
  const configured = loadDataProtectionConfig({
    SASHA_DATA_KEY_ID: '2026-06',
    SASHA_DATA_KEYS: JSON.stringify({
      '2026-05': Buffer.alloc(32, 5).toString('base64'),
      '2026-06': Buffer.alloc(32, 6).toString('base64')
    })
  });
  assert.equal(configured.currentKeyId, '2026-06');
});
