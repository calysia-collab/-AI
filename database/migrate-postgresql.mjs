import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDirectory = resolve(dirname(fileURLToPath(import.meta.url)));
const advisoryLockKey = 1_803_270_426;

function checksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function listPostgresqlMigrations(directory = databaseDirectory) {
  const migrationDirectory = join(directory, 'migrations');
  const names = await readdir(migrationDirectory).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return names
    .filter((item) => /^\d+_.+\.sql$/i.test(item))
    .sort()
    .map((name) => ({ name, filename: join(migrationDirectory, name) }));
}

export async function runPostgresqlMigrations(pool, { directory = databaseDirectory } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [advisoryLockKey]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = [];
    for (const migration of await listPostgresqlMigrations(directory)) {
      const sql = await readFile(migration.filename, 'utf8');
      const digest = checksum(sql);
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [migration.name]
      );
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== digest) {
          throw new Error(`PostgreSQL migration checksum mismatch: ${migration.name}`);
        }
        continue;
      }

      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, digest]
      );
      applied.push(migration.name);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [advisoryLockKey]).catch(() => {});
    client.release();
  }
}
