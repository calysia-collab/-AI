import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../api/auth.mjs';
import { createAppDatabase } from '../api/database.mjs';
import {
  parseRecoveryArguments,
  recoverAccount
} from '../scripts/recover-account.mjs';

test('parses emergency recovery preview and confirmation options', () => {
  assert.deepEqual(
    parseRecoveryArguments(['--username', 'Owner.Account']),
    {
      confirm: false,
      disableMfa: false,
      username: 'owner.account'
    }
  );
  assert.deepEqual(
    parseRecoveryArguments([
      '--username=owner.account',
      '--disable-mfa',
      '--confirm'
    ]),
    {
      confirm: true,
      disableMfa: true,
      username: 'owner.account'
    }
  );
  assert.throws(() => parseRecoveryArguments([]), /--username/);
});

test('recovers an active account, invalidates sessions, and optionally disables MFA', async () => {
  const database = createAppDatabase(':memory:');
  try {
    const originalPassword = await hashPassword('OriginalOwner2026!');
    database.createOrganizationOwner({
      organizationId: 'org-recovery',
      organizationName: 'Recovery Organization',
      userId: 'user-recovery',
      displayName: '張經理',
      username: 'recovery.owner',
      passwordHash: originalPassword.hash,
      passwordSalt: originalPassword.salt
    });
    database.setOrganizationUserMfaPending(
      'org-recovery',
      'user-recovery',
      'encrypted-secret',
      ['recovery-code-hash']
    );
    database.enableOrganizationUserMfa('org-recovery', 'user-recovery', 100);
    database.createSession({
      tokenHash: 'active-session',
      userId: 'user-recovery',
      csrfToken: 'csrf-token',
      createdAt: '2026-06-12T00:00:00.000Z',
      lastSeenAt: '2026-06-12T00:00:00.000Z',
      expiresAt: '2026-06-13T00:00:00.000Z'
    });

    const preview = await recoverAccount(database, {
      username: 'recovery.owner'
    });
    assert.equal(preview.action, 'preview');
    assert.equal(preview.account.mfaEnabled, true);
    assert.ok(database.getSession('active-session'));

    await assert.rejects(
      recoverAccount(database, {
        confirm: true,
        password: 'OriginalOwner2026!',
        username: 'recovery.owner'
      }),
      /RECOVERY_PASSWORD_MUST_BE_NEW/
    );

    const result = await recoverAccount(database, {
      confirm: true,
      disableMfa: true,
      password: 'RecoveredOwner2026!',
      username: 'recovery.owner'
    });
    assert.equal(result.status, 'recovered');
    assert.equal(result.sessionsInvalidated, true);

    const recovered = database.getUserByUsername('recovery.owner');
    assert.equal(recovered.mfaEnabled, false);
    assert.equal(recovered.mfaSecretCiphertext, null);
    assert.equal(database.getSession('active-session'), null);
    assert.equal(
      await verifyPassword(
        'RecoveredOwner2026!',
        recovered.passwordSalt,
        recovered.passwordHash
      ),
      true
    );
    assert.equal(
      database.listOrganizationAuditLogs('org-recovery', 1)[0].action,
      'emergency_recovery'
    );
  } finally {
    database.close();
  }
});
