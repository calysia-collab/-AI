import { join } from 'node:path';

import { createAppDatabase } from './database.mjs';

function postgresqlSsl(environment) {
  const mode = String(environment.SASHA_DATABASE_SSL || 'verify-full').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  throw new Error('SASHA_DATABASE_SSL must be disable, require, or verify-full.');
}

export async function createConfiguredDatabase({
  environment = process.env,
  root,
  poolFactory,
  dataProtection = null
}) {
  const connectionString = String(environment.SASHA_DATABASE_URL || '').trim();
  if (!connectionString) {
    const filename = environment.SASHA_DB_PATH || join(root, '.data', 'sasha-workbench.sqlite');
    return createAppDatabase(filename, { dataProtection });
  }

  const { connectPostgresqlDatabase } = await import('./postgresql-database.mjs');
  return connectPostgresqlDatabase({
    connectionString,
    max: Number(environment.SASHA_DATABASE_POOL_SIZE || 10),
    ssl: postgresqlSsl(environment),
    poolFactory,
    dataProtection
  });
}
