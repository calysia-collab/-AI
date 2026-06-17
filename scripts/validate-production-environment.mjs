import { resolve } from 'node:path';

import {
  createDataProtectionService,
  loadDataProtectionConfig
} from '../api/data-protection.mjs';
import { assertProductionReadiness } from '../api/production-readiness.mjs';
import { loadOrCreateMasterKey } from '../api/security.mjs';

assertProductionReadiness(process.env);

const publicUrl = new URL(String(process.env.SASHA_PUBLIC_URL || ''));
if (publicUrl.protocol !== 'https:') {
  throw new Error('SASHA_PUBLIC_URL must use HTTPS.');
}
const databaseUrl = new URL(process.env.SASHA_DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  throw new Error('SASHA_DATABASE_URL must be a PostgreSQL URL.');
}
if (process.env.SASHA_BOOTSTRAP_ENABLED === 'true') {
  throw new Error('Disable SASHA_BOOTSTRAP_ENABLED after the first owner is created.');
}

const masterKey = loadOrCreateMasterKey(
  resolve('.production-preflight-key-must-not-be-created'),
  process.env.SASHA_MASTER_KEY
);
const protection = createDataProtectionService(
  loadDataProtectionConfig(process.env, masterKey)
);

console.log(JSON.stringify({
  status: 'ok',
  publicOrigin: publicUrl.origin,
  databaseHost: databaseUrl.hostname,
  databaseSsl: process.env.SASHA_DATABASE_SSL,
  dataKeyId: protection.currentKeyId,
  secureCookie: process.env.SASHA_COOKIE_SECURE === 'true',
  trustedProxy: process.env.SASHA_TRUST_PROXY === 'true',
  clamavHostConfigured: Boolean(process.env.SASHA_CLAMD_HOST),
  ocrProvider: process.env.SASHA_OCR_PROVIDER,
  ocrEndpoint: new URL(process.env.SASHA_OCR_ENDPOINT).origin
}, null, 2));
