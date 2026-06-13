import { connectPostgresqlDatabase } from '../api/postgresql-database.mjs';
import { dataProtection } from './runtime-security.mjs';

const connectionString = String(process.env.SASHA_DATABASE_URL || '').trim();
if (!connectionString) {
  throw new Error('SASHA_DATABASE_URL is required.');
}

const mode = String(process.env.SASHA_DATABASE_SSL || 'verify-full').toLowerCase();
if (!['disable', 'require', 'verify-full'].includes(mode)) {
  throw new Error('SASHA_DATABASE_SSL must be disable, require, or verify-full.');
}
const ssl = mode === 'disable'
  ? false
  : { rejectUnauthorized: mode === 'verify-full' };
const database = await connectPostgresqlDatabase({
  connectionString,
  max: Number(process.env.SASHA_DATABASE_POOL_SIZE || 10),
  ssl,
  dataProtection
});
try {
  console.log('PostgreSQL migrations are current.');
} finally {
  await database.close();
}
