import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import pg from 'pg';

import { runPostgresqlMigrations } from '../database/migrate-postgresql.mjs';

const connectionString = process.env.SASHA_TEST_DATABASE_URL || process.env.SASHA_DATABASE_URL;
if (!connectionString) throw new Error('SASHA_TEST_DATABASE_URL is required.');

const sslMode = String(process.env.SASHA_TEST_DATABASE_SSL || 'disable').toLowerCase();
const ssl = sslMode === 'require' ? { rejectUnauthorized: true } : false;
const pool = new pg.Pool({ connectionString, max: 2, ssl });
const organizationId = `org-scale-${randomUUID()}`;
const recordCount = Math.max(100_000, Number(process.env.SASHA_PHASE2_SCALE_RECORDS) || 0);

function executionTime(plan) {
  return Number(plan?.[0]?.['Execution Time'] || 0);
}

try {
  await runPostgresqlMigrations(pool);
  await pool.query(
    'INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, now())',
    [organizationId, 'Phase 2 PostgreSQL Scale']
  );
  await pool.query(`
    INSERT INTO organization_revisions (organization_id, revision) VALUES ($1, 0)
  `, [organizationId]);
  await pool.query(`
    INSERT INTO customers (
      id, organization_id, name, phone, email, birthday, owner, stage,
      next_follow_up, needs, note, version, created_at, updated_at
    )
    SELECT
      'scale-customer-' || lpad(value::text, 6, '0'),
      $1,
      'encrypted-name-' || value,
      '',
      '',
      '',
      '',
      CASE WHEN value % 2 = 0 THEN '新名單' ELSE '需求訪談' END,
      NULL,
      '',
      '',
      1,
      now(),
      now() - (value || ' milliseconds')::interval
    FROM generate_series(1, $2) AS value
  `, [organizationId, recordCount]);
  await pool.query(`
    INSERT INTO search_tokens (
      organization_id, entity_type, entity_id, customer_id,
      display_ciphertext, token_hash, updated_at
    )
    SELECT
      $1,
      'customer',
      'scale-customer-' || lpad(value::text, 6, '0'),
      'scale-customer-' || lpad(value::text, 6, '0'),
      'encrypted-display',
      md5('token-' || value),
      now()
    FROM generate_series(1, $2) AS value
  `, [organizationId, recordCount]);
  await pool.query('ANALYZE customers');
  await pool.query('ANALYZE search_tokens');

  const firstPage = (await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT *
    FROM customers
    WHERE organization_id = $1 AND archived_at IS NULL
    ORDER BY updated_at DESC, id ASC
    LIMIT 101
  `, [organizationId])).rows[0]['QUERY PLAN'];
  const cursor = await pool.query(`
    SELECT updated_at, id
    FROM customers
    WHERE organization_id = $1 AND archived_at IS NULL
    ORDER BY updated_at DESC, id ASC
    OFFSET 99 LIMIT 1
  `, [organizationId]);
  const secondPage = (await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT *
    FROM customers
    WHERE organization_id = $1
      AND archived_at IS NULL
      AND (updated_at < $2 OR (updated_at = $2 AND id > $3))
    ORDER BY updated_at DESC, id ASC
    LIMIT 101
  `, [organizationId, cursor.rows[0].updated_at, cursor.rows[0].id])).rows[0]['QUERY PLAN'];
  const searchPlan = (await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT entity_type, entity_id, customer_id
    FROM search_tokens
    WHERE organization_id = $1 AND token_hash = md5('token-99999')
    LIMIT 20
  `, [organizationId])).rows[0]['QUERY PLAN'];

  assert.ok(executionTime(firstPage) < 1_500);
  assert.ok(executionTime(secondPage) < 1_500);
  assert.ok(executionTime(searchPlan) < 1_500);
  assert.match(JSON.stringify(firstPage), /customers_active_page_idx/);
  assert.match(JSON.stringify(searchPlan), /search_tokens_lookup_idx/);

  console.log(JSON.stringify({
    status: 'ok',
    engine: 'postgresql',
    recordCount,
    firstPageMilliseconds: executionTime(firstPage),
    secondPageMilliseconds: executionTime(secondPage),
    blindIndexSearchMilliseconds: executionTime(searchPlan)
  }, null, 2));
} finally {
  await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]).catch(() => {});
  await pool.end();
}
