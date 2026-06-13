import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function normalizeKey(value) {
  if (Buffer.isBuffer(value) && value.length === 32) return value;
  const text = String(value || '').trim();
  const formats = [
    () => Buffer.from(text, 'base64'),
    () => Buffer.from(text, 'hex')
  ];
  for (const decode of formats) {
    const key = decode();
    if (key.length === 32) return key;
  }
  throw new Error('SASHA_MASTER_KEY must decode to exactly 32 bytes.');
}

export function loadOrCreateMasterKey(filename, environmentValue = process.env.SASHA_MASTER_KEY) {
  if (environmentValue) return normalizeKey(environmentValue);
  if (existsSync(filename)) return normalizeKey(readFileSync(filename, 'utf8'));

  mkdirSync(dirname(filename), { recursive: true });
  const key = randomBytes(32);
  try {
    writeFileSync(filename, key.toString('base64'), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    });
    return key;
  } catch (error) {
    if (error?.code === 'EEXIST') return normalizeKey(readFileSync(filename, 'utf8'));
    throw error;
  }
}

function base32Encode(input) {
  let bits = '';
  for (const byte of input) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5).padEnd(5, '0');
    output += base32Alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 value.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpForCounter(secret, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) % 1_000_000;
  return String(value).padStart(6, '0');
}

function constantTimeTextEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createSecurityService(masterKeyInput = randomBytes(32)) {
  const masterKey = normalizeKey(masterKeyInput);

  function encrypt(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  function decrypt(value) {
    const [version, ivValue, tagValue, encryptedValue] = String(value || '').split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
      throw new Error('Invalid encrypted value.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }

  function verifyTotp(secret, code, now = Date.now(), windowSize = 1) {
    const normalizedCode = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) return null;
    const currentCounter = Math.floor(now / 30_000);
    for (let offset = -windowSize; offset <= windowSize; offset += 1) {
      const counter = currentCounter + offset;
      if (constantTimeTextEqual(totpForCounter(secret, counter), normalizedCode)) return counter;
    }
    return null;
  }

  function hashRecoveryCode(code) {
    return createHmac('sha256', masterKey)
      .update(normalizeRecoveryCode(code))
      .digest('hex');
  }

  function generateRecoveryCodes(count = 10) {
    return Array.from({ length: count }, () => {
      const value = randomBytes(8).toString('hex').toUpperCase();
      return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
    });
  }

  function createMfaSetup({ accountName, issuer = '莎莎保險助理工作台' }) {
    const secret = base32Encode(randomBytes(20));
    const label = `${issuer}:${accountName}`;
    const query = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    });
    return {
      secret,
      encryptedSecret: encrypt(secret),
      otpauthUri: `otpauth://totp/${encodeURIComponent(label)}?${query}`,
      recoveryCodes: generateRecoveryCodes()
    };
  }

  return {
    createMfaSetup,
    decrypt,
    encrypt,
    generateTotp: (secret, now = Date.now()) => totpForCounter(secret, Math.floor(now / 30_000)),
    hashRecoveryCode,
    verifyTotp
  };
}
