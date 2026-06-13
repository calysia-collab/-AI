import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfiguredDatabase } from './api/database-factory.mjs';
import { createAttachmentStorage, createClamdScanner } from './api/attachment-storage.mjs';
import {
  createDataProtectionService,
  loadDataProtectionConfig
} from './api/data-protection.mjs';
import { createApiHandler } from './api/handler.mjs';
import { assertProductionReadiness } from './api/production-readiness.mjs';
import { createSecurityService, loadOrCreateMasterKey } from './api/security.mjs';

assertProductionReadiness(process.env);
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const isLoopbackHost = ['127.0.0.1', 'localhost', '::1'].includes(host);
if (!isLoopbackHost && process.env.SASHA_ALLOW_INSECURE_REMOTE !== 'true') {
  throw new Error('Refusing direct remote access. Use an HTTPS reverse proxy in production.');
}
const databasePath = process.env.SASHA_DB_PATH || join(root, '.data', 'sasha-workbench.sqlite');
const masterKeyPath = process.env.SASHA_MASTER_KEY_PATH || join(root, '.data', 'master.key');
const masterKey = loadOrCreateMasterKey(masterKeyPath, process.env.SASHA_MASTER_KEY);
const security = createSecurityService(masterKey);
const dataProtection = createDataProtectionService(
  loadDataProtectionConfig(process.env, masterKey)
);
const database = await createConfiguredDatabase({
  environment: {
    ...process.env,
    SASHA_DB_PATH: databasePath
  },
  root,
  dataProtection
});
const allowUnscannedAttachments = (
  process.env.SASHA_ATTACHMENT_ALLOW_UNSCANNED === 'true'
  && process.env.NODE_ENV !== 'production'
);
if (
  process.env.NODE_ENV === 'production'
  && process.env.SASHA_ATTACHMENT_ALLOW_UNSCANNED === 'true'
) {
  throw new Error('Production cannot enable SASHA_ATTACHMENT_ALLOW_UNSCANNED.');
}
const attachmentScanner = process.env.SASHA_CLAMD_HOST
  ? createClamdScanner({
    host: process.env.SASHA_CLAMD_HOST,
    port: Number(process.env.SASHA_CLAMD_PORT || 3310),
    timeoutMs: Number(process.env.SASHA_CLAMD_TIMEOUT_MS || 10_000)
  })
  : null;
const attachmentStorage = createAttachmentStorage({
  root: process.env.SASHA_ATTACHMENT_DIR || join(root, '.data', 'attachments'),
  dataProtection,
  scanner: attachmentScanner,
  allowUnscanned: allowUnscannedAttachments
});
for (const attachment of await database.listAttachmentsForMaintenance()) {
  await attachmentStorage.rotate(attachment);
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
const handleApi = createApiHandler(database, securityHeaders, {
  attachmentStorage,
  dataProtection,
  security
});

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { ...securityHeaders, ...headers });
  response.end(body);
}

function getRequestedPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const absolutePath = resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) return null;
  return absolutePath;
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
    if (await handleApi(request, response, requestUrl.pathname)) return;

    if (!['GET', 'HEAD'].includes(request.method || '')) {
      send(response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
      return;
    }

    const filePath = getRequestedPath(request.url || '/');
    if (!filePath) {
      send(response, 400, 'Bad Request');
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error('Not a file');
      const body = request.method === 'HEAD' ? undefined : await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      const cacheControl = filePath.endsWith('service-worker.js')
        ? 'no-cache'
        : extension === '.html'
          ? 'no-cache'
          : 'public, max-age=3600';
      send(response, 200, body, {
        'Cache-Control': cacheControl,
        'Content-Length': String(fileStat.size),
        'Content-Type': mimeTypes[extension] || 'application/octet-stream'
      });
    } catch {
      send(response, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  } catch (error) {
    console.error('Unhandled request error.', error);
    if (!response.headersSent) {
      send(response, 500, 'Internal Server Error', {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8'
      });
    } else {
      response.destroy();
    }
  }
});

server.listen(port, host, () => {
  console.log(`莎莎保險助理工作台已啟動：http://${host}:${port}`);
});

function shutdown() {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

export { attachmentStorage, database, dataProtection, server };
