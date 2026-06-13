import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDataProtectionService,
  loadDataProtectionConfig
} from '../api/data-protection.mjs';
import { loadOrCreateMasterKey } from '../api/security.mjs';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const masterKeyPath = process.env.SASHA_MASTER_KEY_PATH
  || join(root, '.data', 'master.key');
export const masterKey = loadOrCreateMasterKey(
  masterKeyPath,
  process.env.SASHA_MASTER_KEY
);
export const dataProtection = createDataProtectionService(
  loadDataProtectionConfig(process.env, masterKey)
);
export const backupContext = {
  organizationId: 'system',
  entityType: 'backup',
  entityId: 'database',
  field: 'content'
};

