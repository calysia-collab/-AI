import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = new URL(process.env.SASHA_STAGING_BASE_URL || 'https://localhost:8443');
const username = String(process.env.SASHA_STAGING_USERNAME || '').trim();
const password = String(
  process.env.SASHA_STAGING_PASSWORD
  || process.env.SASHA_BOOTSTRAP_PASSWORD
  || ''
);
if (baseUrl.protocol !== 'https:') throw new Error('Staging validation requires HTTPS.');
if (!username || !password) {
  throw new Error('SASHA_STAGING_USERNAME and SASHA_STAGING_PASSWORD are required.');
}
if (process.env.SASHA_STAGING_ALLOW_SELF_SIGNED === 'true') {
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
  const internalProxy = (
    process.env.SASHA_STAGING_INTERNAL_NETWORK === 'true'
    && baseUrl.hostname === 'proxy'
  );
  if (!localHost && !internalProxy) {
    throw new Error('Self-signed TLS bypass is allowed only for isolated staging.');
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function request(path, options = {}, cookie = '') {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('Cookie', cookie);
  return fetch(new URL(path, baseUrl), { ...options, headers, redirect: 'manual' });
}

async function waitFor(path, predicate, cookie, timeout = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const response = await request(path, {}, cookie);
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    if (predicate(payload.item)) return payload.item;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${path}.`);
}

const healthResponse = await request('/api/health');
assert.equal(healthResponse.status, 200);
assert.match(
  healthResponse.headers.get('strict-transport-security') || '',
  /max-age=\d+/
);
const health = await healthResponse.json();
assert.equal(health.status, 'ok');
assert.equal(health.databaseEngine, 'postgresql');

const loginResponse = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const login = await loginResponse.json();
assert.equal(loginResponse.status, 200, JSON.stringify(login));
const setCookie = loginResponse.headers.get('set-cookie') || '';
for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Secure']) {
  assert.match(setCookie, new RegExp(attribute, 'i'));
}
const cookie = setCookie.split(';')[0];
assert.ok(cookie.startsWith('sasha_session='));
assert.ok(login.csrfToken);

const stateResponse = await request('/api/state', {}, cookie);
assert.equal(stateResponse.status, 200);

const metricsResponse = await request('/api/metrics', {}, cookie);
assert.equal(metricsResponse.status, 200);

const phase2StatusResponse = await request('/api/v1/status', {}, cookie);
const phase2Status = await phase2StatusResponse.json();
assert.equal(phase2StatusResponse.status, 200, JSON.stringify(phase2Status));
assert.equal(phase2Status.version, 'v1');
assert.equal(phase2Status.migration.engine, 'postgresql');
assert.equal(phase2Status.migration.schemaReady, true);
assert.deepEqual(phase2Status.migration.missingTables, []);
assert.ok(Object.values(phase2Status.migration.scopeViolations).every((value) => value === 0));
assert.equal(phase2Status.workflowMigration.phase2Ready, true);
assert.equal(phase2Status.workflowMigration.phase3Ready, true);

const phase2CustomerId = `staging-v1-${randomUUID()}`;
const createCustomerResponse = await request('/api/v1/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': login.csrfToken
  },
  body: JSON.stringify({
    id: phase2CustomerId,
    name: 'Staging Phase 2 Customer',
    ownerUserId: login.user.id,
    owner: login.user.displayName,
    stage: '新名單'
  })
}, cookie);
const createdCustomer = await createCustomerResponse.json();
assert.equal(createCustomerResponse.status, 201, JSON.stringify(createdCustomer));
assert.match(createCustomerResponse.headers.get('etag') || '', /-v1"/);

const updateCustomerResponse = await request(`/api/v1/customers/${phase2CustomerId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'If-Match': createCustomerResponse.headers.get('etag'),
    'X-CSRF-Token': login.csrfToken
  },
  body: JSON.stringify({ stage: '需求訪談' })
}, cookie);
const updatedCustomer = await updateCustomerResponse.json();
assert.equal(updateCustomerResponse.status, 200, JSON.stringify(updatedCustomer));
assert.equal(updatedCustomer.item.version, 2);

const archiveCustomerResponse = await request(`/api/v1/customers/${phase2CustomerId}`, {
  method: 'DELETE',
  headers: {
    'If-Match': updateCustomerResponse.headers.get('etag'),
    'X-CSRF-Token': login.csrfToken
  }
}, cookie);
const archivedCustomer = await archiveCustomerResponse.json();
assert.equal(archiveCustomerResponse.status, 200, JSON.stringify(archivedCustomer));
assert.equal(archivedCustomer.item.version, 3);

const archivedListResponse = await request('/api/v1/customers?archived=only&limit=100', {}, cookie);
const archivedList = await archivedListResponse.json();
assert.equal(archivedListResponse.status, 200, JSON.stringify(archivedList));
assert.ok(archivedList.items.some((item) => item.id === phase2CustomerId));

const restoreCustomerResponse = await request(`/api/v1/customers/${phase2CustomerId}/restore`, {
  method: 'POST',
  headers: {
    'If-Match': archiveCustomerResponse.headers.get('etag'),
    'X-CSRF-Token': login.csrfToken
  }
}, cookie);
const restoredCustomer = await restoreCustomerResponse.json();
assert.equal(restoreCustomerResponse.status, 200, JSON.stringify(restoredCustomer));
assert.equal(restoredCustomer.item.version, 4);

const contactResponse = await request(
  `/api/v1/customers/${phase2CustomerId}/contacts`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': login.csrfToken
    },
    body: JSON.stringify({
      contactType: 'phone',
      label: '主要手機',
      value: '0912-345-678',
      isPrimary: true
    })
  },
  cookie
);
const contact = await contactResponse.json();
assert.equal(contactResponse.status, 201, JSON.stringify(contact));
assert.equal(contact.item.value, '0912-345-678');

const workspaceResponse = await request(
  `/api/v1/customers/${phase2CustomerId}/workspace`,
  {},
  cookie
);
const workspace = await workspaceResponse.json();
assert.equal(workspaceResponse.status, 200, JSON.stringify(workspace));
assert.equal(workspace.workspace.contacts.length, 1);

const searchResponse = await request(
  `/api/v1/search?q=${encodeURIComponent('Staging Phase 2 Customer')}`,
  {},
  cookie
);
const search = await searchResponse.json();
assert.equal(searchResponse.status, 200, JSON.stringify(search));
assert.ok(search.items.some((item) => item.id === phase2CustomerId));

const importResponse = await request('/api/v1/import-jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv',
    'X-CSRF-Token': login.csrfToken,
    'X-File-Name': encodeURIComponent('staging-customers.csv')
  },
  body: Buffer.from('客戶姓名,手機,服務階段\n外部驗證客戶,0900000111,新名單\n', 'utf8')
}, cookie);
const importJob = await importResponse.json();
assert.equal(importResponse.status, 202, JSON.stringify(importJob));
const completedImport = await waitFor(
  `/api/v1/import-jobs/${encodeURIComponent(importJob.item.id)}`,
  (item) => ['completed', 'completed_with_errors', 'failed'].includes(item.status),
  cookie
);
assert.equal(completedImport.status, 'completed');
assert.equal(completedImport.imported, 1);

const teamStateResponse = await request('/api/v1/team-state', {}, cookie);
const teamState = await teamStateResponse.json();
assert.equal(teamStateResponse.status, 200, JSON.stringify(teamState));
const saveTeamStateResponse = await request('/api/v1/team-state', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': login.csrfToken
  },
  body: JSON.stringify({
    expectedRevision: teamState.revision,
    teamGoal: teamState.teamGoal,
    teamMembers: teamState.teamMembers,
    teamTasks: teamState.teamTasks
  })
}, cookie);
assert.equal(saveTeamStateResponse.status, 200, await saveTeamStateResponse.text());

const retiredStateWriteResponse = await request('/api/state', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': login.csrfToken
  },
  body: JSON.stringify({})
}, cookie);
assert.equal(retiredStateWriteResponse.status, 410);

const tinyJpeg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02,
  0xff, 0xd9
]);
const uploadResponse = await request('/api/attachments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/octet-stream',
    'X-CSRF-Token': login.csrfToken,
    'X-File-Name': encodeURIComponent('staging-policy.jpg'),
    'X-Customer-Id': encodeURIComponent(phase2CustomerId)
  },
  body: tinyJpeg
}, cookie);
const upload = await uploadResponse.json();
assert.equal(uploadResponse.status, 201, JSON.stringify(upload));
assert.equal(upload.item.status, 'clean');
assert.ok(upload.downloadUrl);

const downloadResponse = await request(upload.downloadUrl, {}, cookie);
assert.equal(downloadResponse.status, 200);
assert.equal(downloadResponse.headers.get('content-type'), 'image/jpeg');
assert.equal(
  Buffer.from(await downloadResponse.arrayBuffer()).includes(Buffer.from('Exif')),
  false
);

const ocrCreateResponse = await request('/api/v1/ocr/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': login.csrfToken
  },
  body: JSON.stringify({
    attachmentId: upload.item.id,
    customerId: phase2CustomerId
  })
}, cookie);
const ocrCreate = await ocrCreateResponse.json();
assert.equal(ocrCreateResponse.status, 202, JSON.stringify(ocrCreate));
const ocrReview = await waitFor(
  `/api/v1/ocr/jobs/${encodeURIComponent(ocrCreate.item.id)}`,
  (item) => ['review_required', 'failed'].includes(item.status),
  cookie
);
assert.equal(ocrReview.status, 'review_required', JSON.stringify(ocrReview));
const premiumField = ocrReview.fields.find((field) => field.name === 'premium');
assert.ok(premiumField);

const correctionResponse = await request(
  `/api/v1/ocr/jobs/${encodeURIComponent(ocrReview.id)}/fields/${encodeURIComponent(premiumField.id)}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': String(premiumField.version),
      'X-CSRF-Token': login.csrfToken
    },
    body: JSON.stringify({ value: '49,800' })
  },
  cookie
);
const correction = await correctionResponse.json();
assert.equal(correctionResponse.status, 200, JSON.stringify(correction));
assert.equal(
  correction.item.fields.find((field) => field.name === 'premium').corrected,
  true
);

const approvalResponse = await request(
  `/api/v1/ocr/jobs/${encodeURIComponent(ocrReview.id)}/approve`,
  {
    method: 'POST',
    headers: { 'X-CSRF-Token': login.csrfToken }
  },
  cookie
);
const approval = await approvalResponse.json();
assert.equal(approvalResponse.status, 200, JSON.stringify(approval));
assert.equal(approval.item.status, 'approved');
assert.equal(approval.policy.premium, '49,800');

const logoutResponse = await request('/api/auth/logout', {
  method: 'POST',
  headers: { 'X-CSRF-Token': login.csrfToken }
}, cookie);
assert.equal(logoutResponse.status, 200);
assert.equal((await request('/api/state', {}, cookie)).status, 401);

console.log(JSON.stringify({
  status: 'ok',
  baseUrl: baseUrl.origin,
  databaseEngine: health.databaseEngine,
  phase2Schema: 'ok',
  phase2VersionedApi: 'ok',
  phase2Customer360ImportAndSearch: 'ok',
  phase3OcrReviewAndApproval: 'ok',
  secureCookie: true,
  attachmentScan: upload.item.scanDetail,
  attachmentDownload: 'ok'
}, null, 2));
