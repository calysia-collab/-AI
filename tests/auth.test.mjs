import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthService,
  hashPassword,
  validateAccountPayload,
  verifyPassword
} from '../api/auth.mjs';
import { createAppDatabase } from '../api/database.mjs';
import { createSecurityService } from '../api/security.mjs';

function localRequest(cookie = '') {
  return {
    headers: { cookie },
    socket: { remoteAddress: '127.0.0.1', encrypted: false }
  };
}

test('password hashing is salted and verifiable', async () => {
  const first = await hashPassword('SashaManager2026!');
  const second = await hashPassword('SashaManager2026!');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword('SashaManager2026!', first.salt, first.hash), true);
  assert.equal(await verifyPassword('WrongPassword2026!', first.salt, first.hash), false);
});

test('account validation enforces production password requirements', () => {
  const invalid = validateAccountPayload({
    organizationName: '莎莎保險助理工作台',
    displayName: '張經理',
    username: '張經理',
    password: 'short'
  }, { setup: true });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('first setup creates an owner and repeated login failures lock the account', async () => {
  const database = createAppDatabase(':memory:');
  const auth = createAuthService(database);
  try {
    const setup = await auth.setup({
      organizationName: '莎莎保險助理工作台',
      displayName: '張經理',
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest());
    assert.equal(setup.statusCode, 201);
    assert.equal(setup.user.role, 'owner');
    assert.equal(database.countUsers(), 1);

    const repeatedSetup = await auth.setup({
      organizationName: '另一個工作台',
      displayName: '其他人',
      username: 'other.manager',
      password: 'AnotherManager2026!'
    }, localRequest());
    assert.equal(repeatedSetup.statusCode, 409);

    let loginResult;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      loginResult = await auth.login({
        username: 'zhang.manager',
        password: 'WrongPassword2026!'
      }, localRequest());
    }
    assert.equal(loginResult.statusCode, 423);
    assert.equal(loginResult.error, 'ACCOUNT_TEMPORARILY_LOCKED');

    const lockedLogin = await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest());
    assert.equal(lockedLogin.statusCode, 423);
  } finally {
    database.close();
  }
});

test('changes passwords, invalidates old sessions, and requires the new password', async () => {
  const database = createAppDatabase(':memory:');
  const auth = createAuthService(database);
  try {
    const setup = await auth.setup({
      organizationName: '莎莎保險助理工作台',
      displayName: '張經理',
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest());
    const oldCookie = setup.cookie.split(';')[0];
    const oldSession = await auth.getSession(localRequest(oldCookie));
    const changed = await auth.changePassword({
      currentPassword: 'SashaManager2026!',
      newPassword: 'SashaManager2027!'
    }, localRequest(oldCookie), oldSession);

    assert.equal(changed.statusCode, 200);
    assert.equal(await auth.getSession(localRequest(oldCookie)), null);
    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest())).statusCode, 401);
    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2027!'
    }, localRequest())).statusCode, 200);
  } finally {
    database.close();
  }
});

test('enables MFA, blocks TOTP replay, consumes recovery codes once, and disables MFA', async () => {
  const database = createAppDatabase(':memory:');
  const security = createSecurityService(Buffer.alloc(32, 23));
  const auth = createAuthService(database, { security });
  try {
    const setup = await auth.setup({
      organizationName: '莎莎保險助理工作台',
      displayName: '張經理',
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest());
    const ownerCookie = setup.cookie.split(';')[0];
    const ownerSession = await auth.getSession(localRequest(ownerCookie));

    assert.equal((await auth.beginMfaSetup({
      currentPassword: 'WrongPassword2026!'
    }, ownerSession)).statusCode, 401);

    const mfaSetup = await auth.beginMfaSetup({
      currentPassword: 'SashaManager2026!'
    }, ownerSession);
    const firstCode = security.generateTotp(mfaSetup.secret);
    assert.equal((await auth.confirmMfaSetup({ code: firstCode }, ownerSession)).statusCode, 200);

    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest())).statusCode, 428);
    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!',
      mfaCode: firstCode
    }, localRequest())).statusCode, 401);

    const recoveryLogin = await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!',
      mfaCode: mfaSetup.recoveryCodes[0]
    }, localRequest());
    assert.equal(recoveryLogin.statusCode, 200);
    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!',
      mfaCode: mfaSetup.recoveryCodes[0]
    }, localRequest())).statusCode, 401);

    const recoveryCookie = recoveryLogin.cookie.split(';')[0];
    const recoverySession = await auth.getSession(localRequest(recoveryCookie));
    const disabled = await auth.disableMfa({
      currentPassword: 'SashaManager2026!',
      code: mfaSetup.recoveryCodes[1]
    }, recoverySession);
    assert.equal(disabled.statusCode, 200);
    assert.equal(await auth.getSession(localRequest(recoveryCookie)), null);
    assert.equal((await auth.login({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    }, localRequest())).statusCode, 200);
  } finally {
    database.close();
  }
});
