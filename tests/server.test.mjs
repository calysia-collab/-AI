import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hashPassword } from '../api/auth.mjs';
import { createSecurityService } from '../api/security.mjs';

process.env.SASHA_DB_PATH = ':memory:';
process.env.SASHA_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.SASHA_ATTACHMENT_ALLOW_UNSCANNED = 'true';
process.env.SASHA_ATTACHMENT_DIR = join(tmpdir(), `sasha-server-attachments-${process.pid}`);
const testSecurity = createSecurityService(Buffer.alloc(32, 7));
const { database, server } = await import('../server.mjs');

let sessionCookie = '';
let csrfToken = '';
let initialAuthStatus = null;
let unauthenticatedStateStatus = null;
let setupResult = null;

function cookieFrom(response) {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

async function authenticatedFetch(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', sessionCookie);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  return fetch(`http://127.0.0.1:4173${path}`, { ...options, headers });
}

async function sessionFetch(path, cookie, token, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', cookie);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', token);
  }
  return fetch(`http://127.0.0.1:4173${path}`, { ...options, headers });
}

test.before(async () => {
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));

  const statusResponse = await fetch('http://127.0.0.1:4173/api/auth/status');
  initialAuthStatus = await statusResponse.json();

  const unauthenticatedResponse = await fetch('http://127.0.0.1:4173/api/state');
  unauthenticatedStateStatus = unauthenticatedResponse.status;

  const setupResponse = await fetch('http://127.0.0.1:4173/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: '莎莎保險助理工作台',
      displayName: '張經理',
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    })
  });
  setupResult = await setupResponse.json();
  sessionCookie = cookieFrom(setupResponse);
  csrfToken = setupResult.csrfToken;
});

test.after(async () => {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.close();
  await rm(process.env.SASHA_ATTACHMENT_DIR, { recursive: true, force: true });
});

test('serves the application with baseline security headers', async () => {
  const response = await fetch('http://127.0.0.1:4173/');
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /core\.js/);
  assert.match(html, /authGate/);
});

test('serves the PWA manifest with the correct content type', async () => {
  const response = await fetch('http://127.0.0.1:4173/manifest.webmanifest');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/manifest\+json/);
});

test('provides a database-backed public health endpoint', async () => {
  const response = await fetch('http://127.0.0.1:4173/api/health');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'available');
  assert.equal(body.databaseEngine, 'sqlite');
});

test('stores policy images privately and only downloads them with a short-lived token', async () => {
  const tinyJpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x02,
    0xff, 0xd9
  ]);
  const uploadResponse = await authenticatedFetch('/api/attachments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent('保單照片.jpg')
    },
    body: tinyJpeg
  });
  const upload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201);
  assert.equal(upload.item.status, 'clean');
  assert.match(upload.downloadUrl, /^\/api\/attachments\//);

  const deniedResponse = await authenticatedFetch(
    `/api/attachments/${encodeURIComponent(upload.item.id)}`
  );
  assert.equal(deniedResponse.status, 403);

  const downloadResponse = await authenticatedFetch(upload.downloadUrl);
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await downloadResponse.arrayBuffer()).includes(Buffer.from('Exif')), false);
});

test('requires initial owner setup and protects application data', () => {
  assert.equal(initialAuthStatus.setupRequired, true);
  assert.equal(initialAuthStatus.authenticated, false);
  assert.equal(unauthenticatedStateStatus, 401);
  assert.equal(setupResult.user.displayName, '張經理');
  assert.equal(setupResult.user.role, 'owner');
  assert.ok(sessionCookie.startsWith('sasha_session='));
  assert.ok(csrfToken.length >= 20);
});

test('validates CSRF and saves synchronized application state', async () => {
  const currentState = await (await authenticatedFetch('/api/state')).json();
  const payload = {
    expectedRevision: currentState.revision,
    customers: [{
      id: 'customer-api-1',
      name: '測試客戶',
      phone: '',
      email: '',
      birthday: '',
      owner: '張經理',
      stage: '新名單',
      nextFollowUp: '',
      needs: '',
      note: ''
    }],
    policies: [],
    events: [],
    teamMembers: [],
    teamTasks: [],
    teamGoal: 0
  };

  const missingCsrfResponse = await fetch('http://127.0.0.1:4173/api/state', {
    method: 'PUT',
    headers: {
      Cookie: sessionCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  assert.equal(missingCsrfResponse.status, 403);

  const saveResponse = await authenticatedFetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const saved = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saved.revision, currentState.revision + 1);

  const stateResponse = await authenticatedFetch('/api/state');
  const state = await stateResponse.json();
  assert.equal(state.revision, currentState.revision + 1);
  assert.equal(state.customers[0].name, '測試客戶');

  const conflictResponse = await authenticatedFetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(conflictResponse.status, 409);
});

test('supports authenticated customer, policy, and event REST resources', async () => {
  const customerResponse = await authenticatedFetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'customer-rest-1',
      name: 'REST 客戶',
      owner: '張經理',
      stage: '新名單'
    })
  });
  const customerResult = await customerResponse.json();
  assert.equal(customerResponse.status, 201);
  assert.equal(customerResult.item.version, 1);

  const policyResponse = await authenticatedFetch('/api/policies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'policy-rest-1',
      customerId: 'customer-rest-1',
      customer: 'REST 客戶',
      company: '測試人壽',
      policyNumber: 'REST-P-001'
    })
  });
  assert.equal(policyResponse.status, 201);

  const eventResponse = await authenticatedFetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'event-rest-1',
      customerId: 'customer-rest-1',
      title: 'REST 會議',
      date: '2026-06-20',
      time: '10:30',
      category: 'meeting',
      reminder: '1 小時前',
      detail: '保單健檢',
      note: '',
      status: 'scheduled'
    })
  });
  const eventResult = await eventResponse.json();
  assert.equal(eventResponse.status, 201);
  assert.equal(eventResult.item.version, 1);

  const updateResponse = await authenticatedFetch('/api/events/event-rest-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...eventResult.item,
      expectedVersion: 1,
      status: 'completed'
    })
  });
  const updateResult = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResult.item.version, 2);
  assert.equal(updateResult.item.status, 'completed');

  const staleResponse = await authenticatedFetch('/api/events/event-rest-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...eventResult.item,
      expectedVersion: 1,
      title: '過期更新'
    })
  });
  assert.equal(staleResponse.status, 409);

  const deleteResponse = await authenticatedFetch('/api/events/event-rest-1', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 2 })
  });
  assert.equal(deleteResponse.status, 200);

  const customerDeleteResponse = await authenticatedFetch('/api/customers/customer-rest-1', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 1 })
  });
  assert.equal(customerDeleteResponse.status, 409);
});

test('exposes protected metrics and privacy-minimized audit entries', async () => {
  const metricsResponse = await authenticatedFetch('/api/metrics');
  const metrics = await metricsResponse.json();
  assert.equal(metricsResponse.status, 200);
  assert.ok(metrics.apiRequests >= 1);
  assert.ok(metrics.successfulMutations >= 1);
  assert.equal(typeof metrics.memory.heapUsedBytes, 'number');
  assert.ok(metrics.records.customers >= 1);

  const auditResponse = await authenticatedFetch('/api/audit?limit=20');
  const audit = await auditResponse.json();
  assert.equal(auditResponse.status, 200);
  assert.ok(audit.items.length >= 1);
  assert.doesNotMatch(JSON.stringify(audit.items), /REST 客戶/);
});

test('allows the owner to create, disable, and reset member accounts', async () => {
  const createResponse = await authenticatedFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: '測試顧問',
      username: 'test.advisor',
      role: 'advisor',
      password: 'AdvisorStart2026!'
    })
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.item.role, 'advisor');
  assert.equal(created.item.active, true);

  const viewerRoleResponse = await authenticatedFetch(`/api/users/${created.item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: created.item.displayName,
      role: 'viewer',
      active: true
    })
  });
  const viewerRoleResult = await viewerRoleResponse.json();
  assert.equal(viewerRoleResponse.status, 200);
  assert.equal(viewerRoleResult.item.role, 'viewer');

  const advisorRoleResponse = await authenticatedFetch(`/api/users/${created.item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: created.item.displayName,
      role: 'advisor',
      active: true
    })
  });
  const advisorRoleResult = await advisorRoleResponse.json();
  assert.equal(advisorRoleResponse.status, 200);
  assert.equal(advisorRoleResult.item.role, 'advisor');

  const listResponse = await authenticatedFetch('/api/users');
  const list = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.ok(list.items.some((item) => item.username === 'test.advisor'));
  assert.doesNotMatch(JSON.stringify(list.items), /passwordHash|passwordSalt/);

  const memberLoginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'test.advisor',
      password: 'AdvisorStart2026!'
    })
  });
  const memberLogin = await memberLoginResponse.json();
  const memberCookie = cookieFrom(memberLoginResponse);
  assert.equal(memberLoginResponse.status, 200);

  const forbiddenUsersResponse = await sessionFetch(
    '/api/users',
    memberCookie,
    memberLogin.csrfToken
  );
  assert.equal(forbiddenUsersResponse.status, 403);

  const forbiddenStateReplace = await sessionFetch(
    '/api/state',
    memberCookie,
    memberLogin.csrfToken,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }
  );
  assert.equal(forbiddenStateReplace.status, 403);

  const disableResponse = await authenticatedFetch(`/api/users/${created.item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: created.item.displayName,
      role: created.item.role,
      active: false
    })
  });
  assert.equal(disableResponse.status, 200);

  const expiredSessionResponse = await sessionFetch(
    '/api/state',
    memberCookie,
    memberLogin.csrfToken
  );
  assert.equal(expiredSessionResponse.status, 401);

  const disabledLoginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'test.advisor',
      password: 'AdvisorStart2026!'
    })
  });
  assert.equal(disabledLoginResponse.status, 401);

  const enableResponse = await authenticatedFetch(`/api/users/${created.item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: created.item.displayName,
      role: created.item.role,
      active: true
    })
  });
  assert.equal(enableResponse.status, 200);

  const resetResponse = await authenticatedFetch(
    `/api/users/${created.item.id}/reset-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AdvisorReset2026!' })
    }
  );
  assert.equal(resetResponse.status, 200);

  const oldPasswordResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'test.advisor',
      password: 'AdvisorStart2026!'
    })
  });
  assert.equal(oldPasswordResponse.status, 401);

  const newPasswordResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'test.advisor',
      password: 'AdvisorReset2026!'
    })
  });
  assert.equal(newPasswordResponse.status, 200);
});

test('enforces advisor customer assignments across state and REST APIs', async () => {
  const advisors = {};
  for (const [key, displayName, username, password] of [
    ['a', '範圍顧問甲', 'scope.advisor.a', 'ScopeAdvisorA2026!'],
    ['b', '範圍顧問乙', 'scope.advisor.b', 'ScopeAdvisorB2026!']
  ]) {
    const response = await authenticatedFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, username, role: 'advisor', password })
    });
    const result = await response.json();
    assert.equal(response.status, 201);
    advisors[key] = { ...result.item, password };
  }

  for (const key of ['a', 'b']) {
    const response = await authenticatedFetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `scope-customer-${key}`,
        name: `範圍客戶${key.toUpperCase()}`,
        ownerUserId: advisors[key].id,
        owner: advisors[key].displayName,
        stage: '新名單'
      })
    });
    assert.equal(response.status, 201);

    const policyResponse = await authenticatedFetch('/api/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `scope-policy-${key}`,
        customerId: `scope-customer-${key}`,
        customer: `範圍客戶${key.toUpperCase()}`,
        company: '範圍測試人壽'
      })
    });
    assert.equal(policyResponse.status, 201);

    const eventResponse = await authenticatedFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `scope-event-${key}`,
        customerId: `scope-customer-${key}`,
        title: `範圍會談 ${key.toUpperCase()}`,
        date: '2026-06-25',
        time: '09:00',
        category: 'meeting',
        status: 'scheduled'
      })
    });
    assert.equal(eventResponse.status, 201);
  }

  const loginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: advisors.a.username,
      password: advisors.a.password
    })
  });
  const login = await loginResponse.json();
  const cookie = cookieFrom(loginResponse);
  assert.equal(loginResponse.status, 200);

  const stateResponse = await sessionFetch('/api/state', cookie, login.csrfToken);
  const state = await stateResponse.json();
  assert.deepEqual(
    state.customers.filter((item) => item.id.startsWith('scope-customer-')).map((item) => item.id),
    ['scope-customer-a']
  );
  assert.deepEqual(
    state.policies.filter((item) => item.id.startsWith('scope-policy-')).map((item) => item.id),
    ['scope-policy-a']
  );
  assert.deepEqual(
    state.events.filter((item) => item.id.startsWith('scope-event-')).map((item) => item.id),
    ['scope-event-a']
  );

  const hiddenCustomerResponse = await sessionFetch(
    '/api/customers/scope-customer-b',
    cookie,
    login.csrfToken
  );
  assert.equal(hiddenCustomerResponse.status, 404);

  const forbiddenPolicyResponse = await sessionFetch(
    '/api/policies',
    cookie,
    login.csrfToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'scope-forbidden-policy',
        customerId: 'scope-customer-b',
        customer: '範圍客戶B',
        company: '不可存取人壽'
      })
    }
  );
  assert.equal(forbiddenPolicyResponse.status, 403);

  const forcedAssignmentResponse = await sessionFetch(
    '/api/customers',
    cookie,
    login.csrfToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'scope-customer-forced',
        name: '自建客戶',
        ownerUserId: advisors.b.id,
        owner: advisors.b.displayName,
        stage: '新名單'
      })
    }
  );
  const forcedAssignment = await forcedAssignmentResponse.json();
  assert.equal(forcedAssignmentResponse.status, 201);
  assert.equal(forcedAssignment.item.ownerUserId, advisors.a.id);
  assert.equal(forcedAssignment.item.owner, advisors.a.displayName);
});

test('keeps API data isolated between organizations', async () => {
  database.createOrganization({ id: 'org-secondary', name: 'Secondary Organization' });
  const password = await hashPassword('SecondaryManager2026!');
  database.createOrganizationUser('org-secondary', null, {
    id: 'user-secondary',
    displayName: 'Secondary Manager',
    username: 'secondary.manager',
    role: 'manager',
    passwordHash: password.hash,
    passwordSalt: password.salt
  });

  const loginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'secondary.manager',
      password: 'SecondaryManager2026!'
    })
  });
  const login = await loginResponse.json();
  const secondaryCookie = cookieFrom(loginResponse);
  assert.equal(loginResponse.status, 200);

  const createResponse = await sessionFetch(
    '/api/customers',
    secondaryCookie,
    login.csrfToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'secondary-customer',
        name: 'Secondary Customer',
        owner: 'Secondary Manager',
        stage: '新名單'
      })
    }
  );
  assert.equal(createResponse.status, 201);

  const ownerStateResponse = await authenticatedFetch('/api/state');
  const ownerState = await ownerStateResponse.json();
  assert.equal(ownerState.customers.some((item) => item.id === 'secondary-customer'), false);

  const secondaryStateResponse = await sessionFetch(
    '/api/state',
    secondaryCookie,
    login.csrfToken
  );
  const secondaryState = await secondaryStateResponse.json();
  assert.deepEqual(
    secondaryState.customers.map((item) => item.id),
    ['secondary-customer']
  );

  const crossOrganizationRead = await sessionFetch(
    '/api/customers/customer-rest-1',
    secondaryCookie,
    login.csrfToken
  );
  assert.equal(crossOrganizationRead.status, 404);
});

test('supports login and invalidates the session after logout', async () => {
  const loginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    })
  });
  const login = await loginResponse.json();
  const loginCookie = cookieFrom(loginResponse);
  assert.equal(loginResponse.status, 200);
  assert.equal(login.user.role, 'owner');

  const logoutResponse = await fetch('http://127.0.0.1:4173/api/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: loginCookie,
      'X-CSRF-Token': login.csrfToken
    }
  });
  assert.equal(logoutResponse.status, 200);

  const stateResponse = await fetch('http://127.0.0.1:4173/api/state', {
    headers: { Cookie: loginCookie }
  });
  assert.equal(stateResponse.status, 401);
});

test('returns a controlled client error for malformed authenticated JSON', async () => {
  const response = await authenticatedFetch('/api/auth/mfa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_JSON' });

  const healthResponse = await fetch('http://127.0.0.1:4173/api/health');
  assert.equal(healthResponse.status, 200);
});

test('changes the owner password through the API and invalidates the previous session', async () => {
  const previousCookie = sessionCookie;
  const response = await authenticatedFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: 'SashaManager2026!',
      newPassword: 'SashaManager2027!'
    })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.user.username, 'zhang.manager');

  sessionCookie = cookieFrom(response);
  csrfToken = result.csrfToken;
  const oldSessionResponse = await fetch('http://127.0.0.1:4173/api/state', {
    headers: { Cookie: previousCookie }
  });
  assert.equal(oldSessionResponse.status, 401);

  const oldPasswordResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2026!'
    })
  });
  assert.equal(oldPasswordResponse.status, 401);
});

test('supports the complete MFA API lifecycle with one-time recovery codes', async () => {
  const setupResponse = await authenticatedFetch('/api/auth/mfa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'SashaManager2027!' })
  });
  const setup = await setupResponse.json();
  assert.equal(setupResponse.status, 200);
  assert.match(setup.secret, /^[A-Z2-7]+$/);
  assert.equal(setup.recoveryCodes.length, 10);

  const confirmationResponse = await authenticatedFetch('/api/auth/mfa/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: testSecurity.generateTotp(setup.secret) })
  });
  assert.equal(confirmationResponse.status, 200);

  const missingMfaResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2027!'
    })
  });
  assert.equal(missingMfaResponse.status, 428);

  const recoveryLoginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2027!',
      mfaCode: setup.recoveryCodes[0]
    })
  });
  const recoveryLogin = await recoveryLoginResponse.json();
  const recoveryCookie = cookieFrom(recoveryLoginResponse);
  assert.equal(recoveryLoginResponse.status, 200);
  assert.equal(recoveryLogin.user.mfaEnabled, true);

  const reusedCodeResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2027!',
      mfaCode: setup.recoveryCodes[0]
    })
  });
  assert.equal(reusedCodeResponse.status, 401);

  const disableResponse = await sessionFetch(
    '/api/auth/mfa',
    recoveryCookie,
    recoveryLogin.csrfToken,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'SashaManager2027!',
        code: setup.recoveryCodes[1]
      })
    }
  );
  assert.equal(disableResponse.status, 200);

  const expiredMfaSessionResponse = await fetch('http://127.0.0.1:4173/api/state', {
    headers: { Cookie: recoveryCookie }
  });
  assert.equal(expiredMfaSessionResponse.status, 401);

  const normalLoginResponse = await fetch('http://127.0.0.1:4173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'zhang.manager',
      password: 'SashaManager2027!'
    })
  });
  assert.equal(normalLoginResponse.status, 200);
});
