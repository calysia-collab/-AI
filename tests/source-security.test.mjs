import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const serviceWorkerSource = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const databaseFactorySource = await readFile(
  new URL('../api/database-factory.mjs', import.meta.url),
  'utf8'
);
const stagingWorkflowSource = await readFile(
  new URL('../.github/workflows/staging-gate.yml', import.meta.url),
  'utf8'
);
const stagingComposeSource = await readFile(
  new URL('../deploy/staging/compose.yml', import.meta.url),
  'utf8'
);
const stagingProxySource = await readFile(
  new URL('../deploy/staging/Caddyfile', import.meta.url),
  'utf8'
);
const stagingEndpointSource = await readFile(
  new URL('../scripts/test-staging-endpoint.mjs', import.meta.url),
  'utf8'
);
const stagingWindowsSource = await readFile(
  new URL('../scripts/run-staging-validation.ps1', import.meta.url),
  'utf8'
);
const dockerfileSource = await readFile(
  new URL('../Dockerfile', import.meta.url),
  'utf8'
);

test('user-entered event and policy fields are escaped before HTML rendering', () => {
  assert.match(appSource, /escapeHTML\(event\.title\)/);
  assert.match(appSource, /escapeHTML\(event\.detail/);
  assert.match(appSource, /escapeHTML\(policy\.company\)/);
  assert.match(appSource, /escapeHTML\(policy\.premium\)/);
});

test('policy form and policy normalization include reviewed detail fields', () => {
  for (const field of ['policyNumber', 'startDate', 'paymentYears', 'summary']) {
    assert.match(htmlSource, new RegExp(`name="${field}"`));
    assert.match(appSource, new RegExp(`${field}: data\\.${field}`));
  }
});

test('the page loads the security core before the application', () => {
  assert.ok(htmlSource.indexOf('core.js') < htmlSource.indexOf('app.js'));
});

test('the frontend reads compatibility state and writes team data through v1 revision checks', () => {
  assert.match(appSource, /apiFetch\('\/api\/state'/);
  assert.match(appSource, /apiFetch\('\/api\/v1\/team-state'/);
  assert.match(appSource, /expectedRevision: backendRevision/);
  assert.match(appSource, /response\.status === 409/);
});

test('the calendar uses individual event APIs and supports event lifecycle states', () => {
  assert.match(appSource, /apiFetch\(path,\s*\{/);
  assert.match(appSource, /method: existingEvent \? 'PUT' : 'POST'/);
  assert.match(appSource, /method: 'DELETE'/);
  assert.match(htmlSource, /id="eventStatus"/);
  assert.match(htmlSource, /value="completed"/);
  assert.match(htmlSource, /value="cancelled"/);
});

test('the frontend gates data behind authentication and adds CSRF headers', () => {
  assert.match(htmlSource, /id="authGate"/);
  assert.match(htmlSource, /id="setupForm"/);
  assert.match(htmlSource, /id="loginForm"/);
  assert.match(appSource, /headers\.set\('X-CSRF-Token', csrfToken\)/);
  assert.match(appSource, /initializeAuthentication\(\)/);
  assert.match(appSource, /prepareLocalOrganization\(result\.user\.organizationId\)/);
  assert.match(appSource, /revealAuthenticatedApplication\(\)/);
});

test('the team page includes organization account management', () => {
  assert.match(htmlSource, /id="accountManagementPanel"/);
  assert.match(htmlSource, /id="accountForm"/);
  assert.match(appSource, /apiFetch\('\/api\/users'/);
  assert.match(appSource, /\/reset-password/);
});

test('customer and policy forms use individual REST resources', () => {
  assert.match(appSource, /requestResourceMutation\(\s*'customers'/);
  assert.match(appSource, /requestResourceMutation\('policies', 'POST'/);
  assert.match(appSource, /\/api\/v1\/\$\{resource\}/);
  assert.match(appSource, /headers\['If-Match'\]/);
  assert.match(htmlSource, /id="customerVersion"/);
});

test('the browser does not persist customer, policy, calendar, or team records in localStorage', () => {
  assert.doesNotMatch(appSource, /writeStorage\(localStorage,\s*'sasha-(?:customers|policies|events|team-members|team-tasks|team-goal|event-outbox)'/);
  assert.match(appSource, /removeStorage\(localStorage, storageKey\)/);
  assert.match(appSource, /客戶資料尚未儲存/);
});

test('policy images use the authenticated private attachment API before OCR', () => {
  assert.match(appSource, /apiFetch\('\/api\/attachments'/);
  assert.match(appSource, /Content-Type': 'application\/octet-stream'/);
  assert.match(appSource, /currentPolicyAttachment\.status !== 'clean'/);
});

test('the service worker never serves the app shell for API requests', () => {
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('account settings include password change and MFA secret cleanup', () => {
  assert.match(htmlSource, /id="changePasswordForm"/);
  assert.match(htmlSource, /id="mfaSetupForm"/);
  assert.match(htmlSource, /id="downloadRecoveryCodes"/);
  assert.match(appSource, /apiFetch\('\/api\/auth\/change-password'/);
  assert.match(appSource, /apiFetch\('\/api\/auth\/mfa\/setup'/);
  assert.match(appSource, /apiFetch\('\/api\/auth\/mfa\/confirm'/);
  assert.match(appSource, /function clearMfaSetupSecrets\(\)/);
  assert.match(appSource, /replaceChildren\(\)/);
});

test('the server supports managed PostgreSQL without changing the SQLite default', () => {
  assert.match(serverSource, /createConfiguredDatabase/);
  assert.match(databaseFactorySource, /SASHA_DATABASE_URL/);
  assert.match(databaseFactorySource, /verify-full/);
  assert.match(databaseFactorySource, /createAppDatabase/);
  assert.match(serverSource, /createDataProtectionService/);
  assert.match(serverSource, /createAttachmentStorage/);
});

test('the staging gate verifies PostgreSQL, ClamAV, HTTPS, recovery, and key rotation', () => {
  assert.match(stagingComposeSource, /postgres:16-alpine/);
  assert.match(stagingComposeSource, /clamav\/clamav:\$\{SASHA_CLAMAV_IMAGE_TAG:-1\.4\}/);
  assert.match(stagingComposeSource, /caddy:2-alpine/);
  assert.doesNotMatch(stagingComposeSource, /3310:3310/);
  assert.match(dockerfileSource, /mkdir -p \/app\/\.data\/attachments/);
  assert.match(dockerfileSource, /chown -R sasha:sasha \/app/);
  assert.match(stagingProxySource, /https:\/\/localhost,\s*https:\/\/proxy/);
  assert.match(stagingEndpointSource, /SASHA_BOOTSTRAP_PASSWORD/);
  assert.match(stagingEndpointSource, /\/api\/v1\/status/);
  assert.match(stagingEndpointSource, /phase2Status\.migration\.schemaReady/);
  assert.match(stagingEndpointSource, /\/api\/v1\/customers/);
  assert.match(stagingEndpointSource, /expectedRevision:\s*teamState\.revision/);
  assert.match(stagingWindowsSource, /staging-endpoint-report\.log/);
  assert.match(stagingWindowsSource, /phase2SchemaAndVersionedApi/);
  assert.match(stagingWindowsSource, /compose-up\.log/);
  assert.match(stagingWindowsSource, /composePreflightCleanup/);
  assert.match(stagingWindowsSource, /down --volumes --remove-orphans/);
  assert.match(stagingWindowsSource, /--force-recreate --renew-anon-volumes/);
  assert.match(stagingWindowsSource, /Initialize-LocalDockerConfig/);
  assert.match(stagingWindowsSource, /DOCKER_CONFIG/);
  assert.match(stagingWindowsSource, /2>&1/);
  assert.match(stagingWorkflowSource, /npm run verify:release/);
  assert.match(stagingWorkflowSource, /npm audit --omit=dev --audit-level=high/);
  assert.match(stagingWorkflowSource, /test-clamav-integration\.mjs/);
  assert.match(stagingWorkflowSource, /test-phase2-postgresql-scale\.mjs/);
  assert.match(stagingWorkflowSource, /test-staging-endpoint\.mjs/);
  assert.match(stagingWorkflowSource, /audit-data-protection\.mjs/);
  assert.match(stagingWorkflowSource, /pg_dump/);
  assert.match(stagingWorkflowSource, /pg_restore/);
  assert.match(stagingWorkflowSource, /SELECT count\(\*\) FROM import_jobs/);
  assert.match(stagingWorkflowSource, /SELECT count\(\*\) FROM search_tokens/);
  assert.match(stagingWorkflowSource, /SELECT count\(\*\) FROM ocr_jobs/);
  assert.match(stagingWorkflowSource, /SELECT count\(\*\) FROM ocr_corrections/);
  assert.doesNotMatch(stagingWorkflowSource, /SashaStaging2026/);
  assert.match(dockerfileSource, /AS verification/);
  assert.match(dockerfileSource, /npm run verify:release/);
  assert.match(dockerfileSource, /npm audit --omit=dev --audit-level=high/);
});
