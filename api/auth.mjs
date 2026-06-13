import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';

import { createSecurityService } from './security.mjs';

const scrypt = promisify(scryptCallback);
const sessionCookieName = 'sasha_session';
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const sessionIdleMs = 30 * 60 * 1000;
const loginLockMs = 15 * 60 * 1000;
const maximumLoginFailures = 5;

function text(value) {
  return String(value ?? '').trim();
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}

function cookieOptions(request, maxAgeSeconds) {
  const forwardedProtocol = process.env.SASHA_TRUST_PROXY === 'true'
    ? String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    : '';
  const secure = Boolean(request.socket?.encrypted)
    || forwardedProtocol === 'https'
    || process.env.SASHA_COOKIE_SECURE === 'true';
  return [
    `${sessionCookieName}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    secure ? 'Secure' : '',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].filter(Boolean);
}

function setSessionCookie(request, token) {
  const options = cookieOptions(request, sessionLifetimeMs / 1000);
  options[0] += encodeURIComponent(token);
  return options.join('; ');
}

function clearSessionCookie(request) {
  return cookieOptions(request, 0).join('; ');
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    mfaEnabled: Boolean(user.mfaEnabled)
  };
}

export function validateAccountPayload(payload, { setup = false } = {}) {
  const errors = [];
  const username = text(payload?.username).toLowerCase();
  const password = String(payload?.password || '');
  const displayName = text(payload?.displayName);
  const organizationName = text(payload?.organizationName);

  if (!/^[a-z0-9._@-]{3,100}$/.test(username)) {
    errors.push('帳號限 3 至 100 個英文字母、數字或 . _ @ -');
  }
  if (password.length < 12 || password.length > 128) {
    errors.push('密碼長度需為 12 至 128 個字元');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    errors.push('密碼需同時包含英文大寫、英文小寫與數字');
  }
  if (setup && (!displayName || displayName.length > 100)) {
    errors.push('顯示名稱不可空白，且不可超過 100 個字元');
  }
  if (setup && (!organizationName || organizationName.length > 200)) {
    errors.push('工作台名稱不可空白，且不可超過 200 個字元');
  }

  return {
    valid: errors.length === 0,
    errors,
    value: { username, password, displayName, organizationName }
  };
}

export function validateManagedUserPayload(payload, { passwordRequired = true } = {}) {
  const errors = [];
  const username = text(payload?.username).toLowerCase();
  const displayName = text(payload?.displayName);
  const password = String(payload?.password || '');
  const role = text(payload?.role || 'advisor');

  if (!displayName || displayName.length > 100) {
    errors.push('成員姓名不可空白，且不可超過 100 個字元');
  }
  if (!/^[a-z0-9._@-]{3,100}$/.test(username)) {
    errors.push('帳號限 3 至 100 個英文字母、數字或 . _ @ -');
  }
  if (!['manager', 'advisor', 'viewer'].includes(role)) {
    errors.push('帳號角色不正確');
  }
  if (passwordRequired || password) {
    if (password.length < 12 || password.length > 128) {
      errors.push('密碼長度需為 12 至 128 個字元');
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      errors.push('密碼需同時包含英文大寫、英文小寫與數字');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      active: payload?.active !== false,
      displayName,
      password,
      role,
      username
    }
  };
}

export function validatePasswordPayload(payload) {
  const password = String(payload?.password || '');
  const errors = [];
  if (password.length < 12 || password.length > 128) {
    errors.push('密碼長度需為 12 至 128 個字元');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    errors.push('密碼需同時包含英文大寫、英文小寫與數字');
  }
  return { valid: errors.length === 0, errors, value: { password } };
}

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return {
    salt,
    hash: Buffer.from(derived).toString('hex')
  };
}

export async function verifyPassword(password, salt, expectedHash) {
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const actual = Buffer.from(derived);
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAuthService(database, { security = createSecurityService() } = {}) {
  async function createSession(user, request) {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const now = Date.now();
    await database.createSession({
      tokenHash: tokenHash(token),
      userId: user.id,
      csrfToken,
      createdAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionLifetimeMs).toISOString()
    });
    return {
      csrfToken,
      cookie: setSessionCookie(request, token),
      user: publicUser(user)
    };
  }

  async function getSession(request, { touch = true } = {}) {
    await database.deleteExpiredSessions(new Date().toISOString());
    const token = parseCookies(request.headers.cookie)[sessionCookieName];
    if (!token) return null;
    const session = await database.getSession(tokenHash(token));
    if (!session || !session.active) return null;

    const now = Date.now();
    const expiresAt = Date.parse(session.expiresAt);
    const lastSeenAt = Date.parse(session.lastSeenAt);
    if (
      !Number.isFinite(expiresAt)
      || !Number.isFinite(lastSeenAt)
      || expiresAt <= now
      || lastSeenAt + sessionIdleMs <= now
    ) {
      await database.deleteSession(session.tokenHash);
      return null;
    }

    if (touch && now - lastSeenAt >= 60_000) {
      await database.touchSession(session.tokenHash, new Date(now).toISOString());
    }
    return session;
  }

  async function setup(payload, request) {
    if (!isLoopbackRequest(request)) {
      return { statusCode: 403, error: 'FIRST_SETUP_REQUIRES_LOCAL_ACCESS' };
    }
    if (await database.countUsers() > 0) {
      return { statusCode: 409, error: 'SETUP_ALREADY_COMPLETED' };
    }
    const validation = validateAccountPayload(payload, { setup: true });
    if (!validation.valid) {
      return { statusCode: 422, error: 'VALIDATION_FAILED', details: validation.errors };
    }

    const password = await hashPassword(validation.value.password);
    const result = await database.createOrganizationOwner({
      organizationId: `org-${randomUUID()}`,
      organizationName: validation.value.organizationName,
      userId: `user-${randomUUID()}`,
      displayName: validation.value.displayName,
      username: validation.value.username,
      passwordHash: password.hash,
      passwordSalt: password.salt
    });
    return { statusCode: 201, ...(await createSession(result.user, request)) };
  }

  async function login(payload, request) {
    const validation = validateAccountPayload(payload);
    if (!validation.valid) {
      return { statusCode: 401, error: 'INVALID_CREDENTIALS' };
    }
    const user = await database.getUserByUsername(validation.value.username);
    const now = Date.now();
    if (!user || !user.active || (user.lockedUntil && Date.parse(user.lockedUntil) > now)) {
      return {
        statusCode: user?.lockedUntil && Date.parse(user.lockedUntil) > now ? 423 : 401,
        error: user?.lockedUntil && Date.parse(user.lockedUntil) > now
          ? 'ACCOUNT_TEMPORARILY_LOCKED'
          : 'INVALID_CREDENTIALS'
      };
    }

    const validPassword = await verifyPassword(
      validation.value.password,
      user.passwordSalt,
      user.passwordHash
    );
    if (!validPassword) {
      const failures = Number(user.failedLoginAttempts || 0) + 1;
      const lockedUntil = failures >= maximumLoginFailures
        ? new Date(now + loginLockMs).toISOString()
        : null;
      await database.recordLoginFailure(user.id, failures, lockedUntil);
      return {
        statusCode: lockedUntil ? 423 : 401,
        error: lockedUntil ? 'ACCOUNT_TEMPORARILY_LOCKED' : 'INVALID_CREDENTIALS'
      };
    }

    if (user.mfaEnabled) {
      const mfaCode = String(payload?.mfaCode || '').trim();
      if (!mfaCode) {
        return { statusCode: 428, error: 'MFA_REQUIRED' };
      }
      let verified = false;
      if (/^\d{6}$/.test(mfaCode.replace(/\s/g, ''))) {
        try {
          const secret = security.decrypt(user.mfaSecretCiphertext);
          const counter = security.verifyTotp(secret, mfaCode);
          verified = counter !== null && await database.consumeUserTotpCounter(user.id, counter);
        } catch {
          verified = false;
        }
      } else {
        verified = await database.consumeUserRecoveryCode(
          user.id,
          security.hashRecoveryCode(mfaCode)
        );
      }
      if (!verified) {
        const failures = Number(user.failedLoginAttempts || 0) + 1;
        const lockedUntil = failures >= maximumLoginFailures
          ? new Date(now + loginLockMs).toISOString()
          : null;
        await database.recordLoginFailure(user.id, failures, lockedUntil);
        return {
          statusCode: lockedUntil ? 423 : 401,
          error: lockedUntil ? 'ACCOUNT_TEMPORARILY_LOCKED' : 'INVALID_MFA_CODE'
        };
      }
    }

    await database.recordLoginSuccess(user.id, new Date(now).toISOString());
    const refreshedUser = await database.getUserById(user.id);
    return { statusCode: 200, ...(await createSession(refreshedUser, request)) };
  }

  async function verifyCurrentPassword(userId, password) {
    const user = await database.getUserById(userId);
    if (!user || !user.active) return { valid: false, user: null };
    return {
      valid: await verifyPassword(String(password || ''), user.passwordSalt, user.passwordHash),
      user
    };
  }

  async function changePassword(payload, request, session) {
    const validation = validatePasswordPayload({ password: payload?.newPassword });
    if (!validation.valid) {
      return { statusCode: 422, error: 'VALIDATION_FAILED', details: validation.errors };
    }
    const current = await verifyCurrentPassword(session.id, payload?.currentPassword);
    if (!current.valid) return { statusCode: 401, error: 'CURRENT_PASSWORD_INVALID' };
    const password = await hashPassword(validation.value.password);
    await database.changeOrganizationUserPassword(
      session.organizationId,
      session.id,
      password.hash,
      password.salt
    );
    const refreshedUser = await database.getUserById(session.id);
    return { statusCode: 200, ...(await createSession(refreshedUser, request)) };
  }

  async function beginMfaSetup(payload, session) {
    const current = await verifyCurrentPassword(session.id, payload?.currentPassword);
    if (!current.valid) return { statusCode: 401, error: 'CURRENT_PASSWORD_INVALID' };
    if (current.user.mfaEnabled) return { statusCode: 409, error: 'MFA_ALREADY_ENABLED' };

    const setup = security.createMfaSetup({
      accountName: current.user.username,
      issuer: current.user.organizationName || '莎莎保險助理工作台'
    });
    await database.setOrganizationUserMfaPending(
      session.organizationId,
      session.id,
      setup.encryptedSecret,
      setup.recoveryCodes.map((code) => security.hashRecoveryCode(code))
    );
    return {
      statusCode: 200,
      secret: setup.secret,
      otpauthUri: setup.otpauthUri,
      recoveryCodes: setup.recoveryCodes
    };
  }

  async function confirmMfaSetup(payload, session) {
    const user = await database.getUserById(session.id);
    if (!user?.mfaSecretCiphertext) {
      return { statusCode: 409, error: 'MFA_SETUP_NOT_STARTED' };
    }
    let counter = null;
    try {
      counter = security.verifyTotp(
        security.decrypt(user.mfaSecretCiphertext),
        payload?.code
      );
    } catch {
      counter = null;
    }
    if (counter === null) return { statusCode: 422, error: 'INVALID_MFA_CODE' };
    const result = await database.enableOrganizationUserMfa(
      session.organizationId,
      session.id,
      counter
    );
    return { statusCode: result.notFound ? 404 : 200, mfaEnabled: !result.notFound };
  }

  async function disableMfa(payload, session) {
    const current = await verifyCurrentPassword(session.id, payload?.currentPassword);
    if (!current.valid) return { statusCode: 401, error: 'CURRENT_PASSWORD_INVALID' };
    if (!current.user.mfaEnabled) return { statusCode: 409, error: 'MFA_NOT_ENABLED' };

    let verified = false;
    const mfaCode = String(payload?.code || '').trim();
    if (/^\d{6}$/.test(mfaCode.replace(/\s/g, ''))) {
      const counter = security.verifyTotp(
        security.decrypt(current.user.mfaSecretCiphertext),
        mfaCode
      );
      verified = counter !== null && await database.consumeUserTotpCounter(session.id, counter);
    } else {
      verified = await database.consumeUserRecoveryCode(
        session.id,
        security.hashRecoveryCode(mfaCode)
      );
    }
    if (!verified) return { statusCode: 422, error: 'INVALID_MFA_CODE' };
    await database.disableOrganizationUserMfa(session.organizationId, session.id);
    return { statusCode: 200, signedOut: true };
  }

  async function logout(request) {
    const token = parseCookies(request.headers.cookie)[sessionCookieName];
    if (token) await database.deleteSession(tokenHash(token));
    return { cookie: clearSessionCookie(request) };
  }

  async function status(request) {
    const session = await getSession(request);
    return {
      setupRequired: await database.countUsers() === 0,
      authenticated: Boolean(session),
      csrfToken: session?.csrfToken || null,
      user: publicUser(session)
    };
  }

  return {
    clearSessionCookie,
    beginMfaSetup,
    changePassword,
    confirmMfaSetup,
    disableMfa,
    getSession,
    login,
    logout,
    setup,
    status
  };
}
