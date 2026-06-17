import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfiguredDatabase } from '../api/database-factory.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const database = await createConfiguredDatabase({
  environment: process.env,
  root
});

try {
  const report = await database.phase2MigrationReport();
  const violationCount = Object.values(report.scopeViolations)
    .reduce((total, value) => total + Number(value || 0), 0);
  console.log(JSON.stringify({
    ...report,
    status: report.schemaReady && violationCount === 0 ? 'ok' : 'failed'
  }, null, 2));
  if (!report.schemaReady) {
    throw new Error(`Phase 2 tables are missing: ${report.missingTables.join(', ')}`);
  }
  if (violationCount) {
    throw new Error(`Phase 2 organization scope violations: ${violationCount}`);
  }
} finally {
  await database.close();
}
