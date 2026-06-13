import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';

const textPrefix = 'enc.v1';
const fileMagic = Buffer.from('SASHAF01', 'ascii');

function normalizeKey(value, label = 'data key') {
  if (Buffer.isBuffer(value) && value.length === 32) return Buffer.from(value);
  const text = String(value || '').trim();
  for (const encoding of ['base64', 'hex']) {
    const decoded = Buffer.from(text, encoding);
    if (decoded.length === 32) return decoded;
  }
  throw new Error(`${label} must decode to exactly 32 bytes.`);
}

function normalizeContext(context = {}) {
  return [
    String(context.organizationId || ''),
    String(context.entityType || ''),
    String(context.entityId || ''),
    String(context.field || '')
  ].join('|');
}

function encodePayload(value) {
  return Buffer.from(String(value ?? ''), 'utf8');
}

function decodeKeyring(keys) {
  if (keys instanceof Map) {
    return new Map([...keys].map(([id, key]) => [String(id), normalizeKey(key, `data key ${id}`)]));
  }
  return new Map(Object.entries(keys || {}).map(
    ([id, key]) => [String(id), normalizeKey(key, `data key ${id}`)]
  ));
}

export function loadDataProtectionConfig(
  environment = process.env,
  fallbackMasterKey
) {
  let keys = {};
  if (environment.SASHA_DATA_KEYS) {
    try {
      keys = JSON.parse(environment.SASHA_DATA_KEYS);
    } catch {
      throw new Error('SASHA_DATA_KEYS must be a JSON object of key IDs to base64 or hex keys.');
    }
  } else if (fallbackMasterKey) {
    keys = { 'local-v1': normalizeKey(fallbackMasterKey).toString('base64') };
  } else {
    throw new Error('SASHA_DATA_KEYS or a fallback master key is required.');
  }

  const keyIds = Object.keys(keys);
  const currentKeyId = String(environment.SASHA_DATA_KEY_ID || keyIds[0] || '');
  if (!currentKeyId || !Object.hasOwn(keys, currentKeyId)) {
    throw new Error('SASHA_DATA_KEY_ID must identify a key in SASHA_DATA_KEYS.');
  }
  return { currentKeyId, keys };
}

export function createDataProtectionService({ currentKeyId, keys }) {
  const keyring = decodeKeyring(keys);
  const activeKeyId = String(currentKeyId || '');
  if (!keyring.has(activeKeyId)) {
    throw new Error('The current data protection key is not present in the keyring.');
  }

  function encryptPayload(payload, context) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyring.get(activeKeyId), iv);
    cipher.setAAD(Buffer.from(normalizeContext(context), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
  }

  function decryptPayload({ ciphertext, iv, tag, keyId }, context) {
    const key = keyring.get(keyId);
    if (!key) throw new Error(`Unknown data protection key: ${keyId}`);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(normalizeContext(context), 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  function protectText(value, context) {
    const { ciphertext, iv, tag } = encryptPayload(encodePayload(value), context);
    return [
      textPrefix,
      Buffer.from(activeKeyId, 'utf8').toString('base64url'),
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url')
    ].join('.');
  }

  function parseTextEnvelope(value) {
    const parts = String(value || '').split('.');
    if (parts.length !== 6 || `${parts[0]}.${parts[1]}` !== textPrefix) return null;
    return {
      keyId: Buffer.from(parts[2], 'base64url').toString('utf8'),
      iv: Buffer.from(parts[3], 'base64url'),
      tag: Buffer.from(parts[4], 'base64url'),
      ciphertext: Buffer.from(parts[5], 'base64url')
    };
  }

  function unprotectText(value, context) {
    const envelope = parseTextEnvelope(value);
    if (!envelope) return String(value ?? '');
    return decryptPayload(envelope, context).toString('utf8');
  }

  function protectBuffer(value, context) {
    const { ciphertext, iv, tag } = encryptPayload(Buffer.from(value), context);
    const keyId = Buffer.from(activeKeyId, 'utf8');
    if (keyId.length > 255) throw new Error('Data protection key ID is too long.');
    return Buffer.concat([
      fileMagic,
      Buffer.from([keyId.length]),
      keyId,
      iv,
      tag,
      ciphertext
    ]);
  }

  function parseBufferEnvelope(value) {
    const input = Buffer.from(value);
    if (input.length < fileMagic.length + 1 || !input.subarray(0, fileMagic.length).equals(fileMagic)) {
      throw new Error('Invalid encrypted file.');
    }
    const keyIdLength = input[fileMagic.length];
    const keyIdOffset = fileMagic.length + 1;
    const ivOffset = keyIdOffset + keyIdLength;
    const tagOffset = ivOffset + 12;
    const ciphertextOffset = tagOffset + 16;
    if (input.length < ciphertextOffset) throw new Error('Invalid encrypted file.');
    return {
      keyId: input.subarray(keyIdOffset, ivOffset).toString('utf8'),
      iv: input.subarray(ivOffset, tagOffset),
      tag: input.subarray(tagOffset, ciphertextOffset),
      ciphertext: input.subarray(ciphertextOffset)
    };
  }

  function unprotectBuffer(value, context) {
    return decryptPayload(parseBufferEnvelope(value), context);
  }

  function needsRotation(value) {
    const envelope = parseTextEnvelope(value);
    return Boolean(envelope && envelope.keyId !== activeKeyId);
  }

  function blindIndex(value, context = {}) {
    return createHmac('sha256', keyring.get(activeKeyId))
      .update(`${normalizeContext(context)}|${String(value ?? '').trim().toLowerCase()}`)
      .digest('hex');
  }

  function createScopedToken(payload, ttlMs = 5 * 60 * 1000) {
    const body = Buffer.from(JSON.stringify({
      ...payload,
      exp: Date.now() + Math.max(1_000, Number(ttlMs) || 0)
    }), 'utf8').toString('base64url');
    const signature = createHmac('sha256', keyring.get(activeKeyId))
      .update(`${activeKeyId}.${body}`)
      .digest('base64url');
    return `${activeKeyId}.${body}.${signature}`;
  }

  function verifyScopedToken(token, expected = {}) {
    const [keyId, body, signature] = String(token || '').split('.');
    const key = keyring.get(keyId);
    if (!key || !body || !signature) return null;
    const calculated = createHmac('sha256', key).update(`${keyId}.${body}`).digest();
    const provided = Buffer.from(signature, 'base64url');
    if (calculated.length !== provided.length || !timingSafeEqual(calculated, provided)) return null;
    let payload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!payload.exp || Number(payload.exp) < Date.now()) return null;
    for (const [name, value] of Object.entries(expected)) {
      if (String(payload[name] ?? '') !== String(value ?? '')) return null;
    }
    return payload;
  }

  return {
    blindIndex,
    createScopedToken,
    currentKeyId: activeKeyId,
    getProtectedBufferKeyId: (value) => {
      try {
        return parseBufferEnvelope(value).keyId;
      } catch {
        return null;
      }
    },
    getProtectedTextKeyId: (value) => parseTextEnvelope(value)?.keyId || null,
    isProtectedBuffer: (value) => {
      const input = Buffer.from(value || []);
      return input.length >= fileMagic.length
        && input.subarray(0, fileMagic.length).equals(fileMagic);
    },
    isProtectedText: (value) => Boolean(parseTextEnvelope(value)),
    needsBufferRotation: (value) => {
      try {
        return parseBufferEnvelope(value).keyId !== activeKeyId;
      } catch {
        return false;
      }
    },
    needsRotation,
    protectBuffer,
    protectText,
    unprotectBuffer,
    unprotectText,
    verifyScopedToken
  };
}
