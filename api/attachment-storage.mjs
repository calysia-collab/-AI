import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { dirname, join, resolve, sep } from 'node:path';

const imageTypes = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

function detectMediaType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )) {
    return 'image/png';
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function sanitizeFilename(value) {
  const filename = String(value || 'policy-image')
    .replaceAll('\\', '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (filename || 'policy-image').slice(0, 200);
}

function stripJpegMetadata(input) {
  if (input.length < 4) return input;
  const output = [input.subarray(0, 2)];
  let offset = 2;
  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) return input;
    const markerStart = offset;
    while (offset < input.length && input[offset] === 0xff) offset += 1;
    const marker = input[offset];
    offset += 1;
    if (marker === 0xda || marker === 0xd9) {
      output.push(input.subarray(markerStart));
      return Buffer.concat(output);
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      output.push(input.subarray(markerStart, offset));
      continue;
    }
    if (offset + 2 > input.length) return input;
    const length = input.readUInt16BE(offset);
    const segmentEnd = offset + length;
    if (length < 2 || segmentEnd > input.length) return input;
    if (![0xe1, 0xed, 0xfe].includes(marker)) {
      output.push(input.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }
  return Buffer.concat(output);
}

function stripPngMetadata(input) {
  const output = [input.subarray(0, 8)];
  const stripped = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > input.length) return input;
    const type = input.subarray(offset + 4, offset + 8).toString('ascii');
    if (!stripped.has(type)) output.push(input.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(output);
}

function stripWebpMetadata(input) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= input.length) {
    const type = input.subarray(offset, offset + 4).toString('ascii');
    const length = input.readUInt32LE(offset + 4);
    const paddedLength = length + (length % 2);
    const end = offset + 8 + paddedLength;
    if (end > input.length) return input;
    if (!['EXIF', 'XMP '].includes(type)) {
      const chunk = Buffer.from(input.subarray(offset, end));
      if (type === 'VP8X' && length >= 1) chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    offset = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

export function sanitizeImage(buffer, mediaType) {
  if (mediaType === 'image/jpeg') return stripJpegMetadata(buffer);
  if (mediaType === 'image/png') return stripPngMetadata(buffer);
  if (mediaType === 'image/webp') return stripWebpMetadata(buffer);
  throw new Error('UNSUPPORTED_ATTACHMENT_TYPE');
}

export function createClamdScanner({
  host = '127.0.0.1',
  port = 3310,
  timeoutMs = 10_000
} = {}) {
  return async function scan(buffer) {
    return new Promise((resolveScan) => {
      const socket = connect({ host, port: Number(port) });
      let response = '';
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolveScan(result);
      };
      socket.setTimeout(Number(timeoutMs), () => finish({
        status: 'unavailable',
        detail: 'scanner-timeout'
      }));
      socket.on('error', (error) => finish({
        status: 'unavailable',
        detail: error.code || 'scanner-error'
      }));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
      });
      socket.on('end', () => {
        if (/\bOK\b/.test(response)) finish({ status: 'clean', detail: 'clamd' });
        else if (/\bFOUND\b/.test(response)) finish({ status: 'infected', detail: response.trim() });
        else finish({ status: 'unavailable', detail: response.trim() || 'scanner-invalid-response' });
      });
      socket.on('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0', 'ascii'));
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
    });
  };
}

export function createAttachmentStorage({
  root,
  dataProtection,
  scanner,
  allowUnscanned = false,
  maximumBytes = 10 * 1024 * 1024
}) {
  const storageRoot = resolve(root);

  function storagePath(organizationId, attachmentId, status) {
    const directory = status === 'clean' ? 'clean' : 'quarantine';
    const target = resolve(storageRoot, String(organizationId), directory, `${attachmentId}.sasha`);
    if (!target.startsWith(`${storageRoot}${sep}`)) throw new Error('INVALID_ATTACHMENT_PATH');
    return target;
  }

  async function scanBuffer(buffer) {
    if (buffer.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE', 'ascii'))) {
      return { status: 'infected', detail: 'eicar-test-signature' };
    }
    if (scanner) return scanner(buffer);
    return allowUnscanned
      ? { status: 'clean', detail: 'development-bypass' }
      : { status: 'quarantined', detail: 'scanner-not-configured' };
  }

  async function store({
    attachmentId = `attachment-${randomUUID()}`,
    organizationId,
    originalName,
    buffer
  }) {
    const input = Buffer.from(buffer || []);
    if (!input.length) throw new Error('EMPTY_ATTACHMENT');
    if (input.length > maximumBytes) throw new Error('ATTACHMENT_TOO_LARGE');
    const mediaType = detectMediaType(input);
    if (!mediaType) throw new Error('UNSUPPORTED_ATTACHMENT_TYPE');
    const sanitized = sanitizeImage(input, mediaType);
    const scan = await scanBuffer(sanitized);
    const status = scan.status === 'clean'
      ? 'clean'
      : scan.status === 'infected'
        ? 'infected'
        : 'quarantined';
    const target = storagePath(organizationId, attachmentId, status);
    const encrypted = dataProtection.protectBuffer(sanitized, {
      organizationId,
      entityType: 'attachment',
      entityId: attachmentId,
      field: 'content'
    });
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
    return {
      id: attachmentId,
      mediaType,
      originalName: sanitizeFilename(originalName),
      scanDetail: scan.detail || '',
      scannedAt: status === 'quarantined' ? null : new Date().toISOString(),
      sha256: createHash('sha256').update(sanitized).digest('hex'),
      sizeBytes: sanitized.length,
      status,
      storageKey: target.slice(storageRoot.length + 1).replaceAll('\\', '/')
    };
  }

  async function read(item) {
    if (item.status !== 'clean') throw new Error('ATTACHMENT_NOT_CLEAN');
    const target = storagePath(item.organizationId, item.id, item.status);
    const encrypted = await readFile(target);
    return dataProtection.unprotectBuffer(encrypted, {
      organizationId: item.organizationId,
      entityType: 'attachment',
      entityId: item.id,
      field: 'content'
    });
  }

  async function rotate(item) {
    const target = storagePath(item.organizationId, item.id, item.status);
    const encrypted = await readFile(target);
    if (!dataProtection.needsBufferRotation(encrypted)) return false;
    const context = {
      organizationId: item.organizationId,
      entityType: 'attachment',
      entityId: item.id,
      field: 'content'
    };
    const plaintext = dataProtection.unprotectBuffer(encrypted, context);
    const rotated = dataProtection.protectBuffer(plaintext, context);
    const temporary = `${target}.${randomUUID()}.rotating`;
    await writeFile(temporary, rotated, { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
    return true;
  }

  async function protectionStatus(items) {
    const result = {
      currentKeyId: dataProtection.currentKeyId,
      currentFiles: 0,
      oldKeyFiles: 0,
      plaintextFiles: 0,
      missingFiles: 0
    };
    for (const item of items) {
      try {
        const encrypted = await readFile(storagePath(
          item.organizationId,
          item.id,
          item.status
        ));
        const keyId = dataProtection.getProtectedBufferKeyId(encrypted);
        if (!keyId) result.plaintextFiles += 1;
        else if (keyId === dataProtection.currentKeyId) result.currentFiles += 1;
        else result.oldKeyFiles += 1;
      } catch (error) {
        if (error?.code === 'ENOENT') result.missingFiles += 1;
        else throw error;
      }
    }
    return result;
  }

  async function remove(item) {
    const target = storagePath(item.organizationId, item.id, item.status);
    await rm(target, { force: true });
  }

  return {
    createDownloadToken: (item, ttlMs) => dataProtection.createScopedToken({
      attachmentId: item.id,
      organizationId: item.organizationId,
      purpose: 'attachment-download'
    }, ttlMs),
    protectionStatus,
    read,
    remove,
    rotate,
    store,
    verifyDownloadToken: (token, item) => dataProtection.verifyScopedToken(token, {
      attachmentId: item.id,
      organizationId: item.organizationId,
      purpose: 'attachment-download'
    })
  };
}
