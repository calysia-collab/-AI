import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createSecurityService,
  loadOrCreateMasterKey
} from '../api/security.mjs';
import { assertProductionReadiness } from '../api/production-readiness.mjs';

const fixedKey = Buffer.alloc(32, 19);

test('encrypts sensitive values and rejects tampered ciphertext', () => {
  const security = createSecurityService(fixedKey);
  const encrypted = security.encrypt('TOTP-SECRET');
  assert.notEqual(encrypted, 'TOTP-SECRET');
  assert.equal(security.decrypt(encrypted), 'TOTP-SECRET');

  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => security.decrypt(tampered));
});

test('generates and verifies time-based one-time passwords', () => {
  const security = createSecurityService(fixedKey);
  const setup = security.createMfaSetup({
    accountName: 'zhang.manager',
    issuer: '莎莎保險助理工作台'
  });
  const now = 1_800_000_000_000;
  const code = security.generateTotp(setup.secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(security.verifyTotp(setup.secret, code, now), Math.floor(now / 30_000));
  assert.equal(security.verifyTotp(setup.secret, '000000', now, 0), null);
  assert.match(setup.otpauthUri, /^otpauth:\/\/totp\//);
});

test('normalizes recovery codes before keyed hashing', () => {
  const security = createSecurityService(fixedKey);
  assert.equal(
    security.hashRecoveryCode('ABCD-EF12-3456-7890'),
    security.hashRecoveryCode('abcd ef12 3456 7890')
  );
  assert.notEqual(
    security.hashRecoveryCode('ABCD-EF12-3456-7890'),
    security.hashRecoveryCode('ABCD-EF12-3456-7891')
  );
});

test('creates and reuses a persistent local master key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sasha-key-test-'));
  const filename = join(directory, 'master.key');
  try {
    const first = loadOrCreateMasterKey(filename, '');
    const second = loadOrCreateMasterKey(filename, '');
    assert.equal(first.length, 32);
    assert.deepEqual(second, first);
    assert.equal(Buffer.from((await readFile(filename, 'utf8')).trim(), 'base64').length, 32);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('production startup fails closed when required security services are missing', () => {
  assert.throws(
    () => assertProductionReadiness({ NODE_ENV: 'production' }),
    /SASHA_DATABASE_URL/
  );
  assert.doesNotThrow(() => assertProductionReadiness({
    NODE_ENV: 'production',
    SASHA_ATTACHMENT_ALLOW_UNSCANNED: 'false',
    SASHA_CLAMD_HOST: 'clamd.internal',
    SASHA_COOKIE_SECURE: 'true',
    SASHA_DATABASE_SSL: 'verify-full',
    SASHA_DATABASE_URL: 'postgresql://example.invalid/sasha',
    SASHA_DATA_KEY_ID: '2026-06',
    SASHA_DATA_KEYS: '{"2026-06":"key"}',
    SASHA_MASTER_KEY: 'key',
    SASHA_TRUST_PROXY: 'true'
  }));
});
