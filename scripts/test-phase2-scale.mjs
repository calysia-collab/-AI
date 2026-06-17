import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';

import { createAppDatabase } from '../api/database.mjs';

const recordCount = Math.max(100_000, Number(process.env.SASHA_PHASE2_SCALE_RECORDS) || 0);
const directory = await mkdtemp(join(tmpdir(), 'sasha-phase2-scale-'));
const filename = join(directory, 'scale.sqlite');

try {
  const setupDatabase = createAppDatabase(filename);
  setupDatabase.createOrganization({
    id: 'org-phase2-scale',
    name: 'Phase 2 Scale Test'
  });
  setupDatabase.close();

  const seedDatabase = new DatabaseSync(filename);
  const insert = seedDatabase.prepare(`
    INSERT INTO customers (
      id, organization_id, name, phone, email, birthday, owner, stage,
      next_follow_up, needs, note, version, created_at, updated_at
    ) VALUES (?, 'org-phase2-scale', ?, '', '', '', '', ?, '', '', '', 1, ?, ?)
  `);
  const timestamp = '2026-06-13T00:00:00.000Z';
  seedDatabase.exec('BEGIN IMMEDIATE');
  for (let index = 0; index < recordCount; index += 1) {
    const id = `customer-${String(index).padStart(6, '0')}`;
    insert.run(id, `客戶 ${index}`, index % 2 ? '需求訪談' : '新名單', timestamp, timestamp);
  }
  seedDatabase.exec('COMMIT');
  const queryPlan = seedDatabase.prepare(`
    EXPLAIN QUERY PLAN
    SELECT customers.*
    FROM customers
    WHERE customers.organization_id = ? AND customers.archived_at IS NULL
    ORDER BY customers.updated_at DESC, customers.id ASC
    LIMIT 101
  `).all('org-phase2-scale');
  seedDatabase.close();

  assert.match(
    queryPlan.map((row) => row.detail).join('\n'),
    /customers_active_page_idx/
  );

  const database = createAppDatabase(filename);
  const startedAt = performance.now();
  const firstPage = database.listOrganizationResourcePage(
    'customers',
    'org-phase2-scale',
    null,
    { limit: 100 }
  );
  const firstPageMilliseconds = performance.now() - startedAt;
  assert.equal(firstPage.items.length, 100);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPageMilliseconds < 1_000);

  const secondPageStartedAt = performance.now();
  const secondPage = database.listOrganizationResourcePage(
    'customers',
    'org-phase2-scale',
    null,
    {
      cursor: {
        id: firstPage.items.at(-1).id,
        updatedAt: firstPage.items.at(-1).updatedAt
      },
      limit: 100
    }
  );
  const secondPageMilliseconds = performance.now() - secondPageStartedAt;
  assert.equal(secondPage.items.length, 100);
  assert.equal(secondPage.hasMore, true);
  assert.notEqual(secondPage.items[0].id, firstPage.items[0].id);
  assert.ok(secondPageMilliseconds < 1_000);
  database.close();

  console.log(JSON.stringify({
    firstPageMilliseconds: Number(firstPageMilliseconds.toFixed(2)),
    index: 'customers_active_page_idx',
    recordCount,
    secondPageMilliseconds: Number(secondPageMilliseconds.toFixed(2)),
    status: 'ok'
  }, null, 2));
} finally {
  await rm(directory, { force: true, recursive: true });
}
