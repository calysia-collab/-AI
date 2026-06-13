import assert from 'node:assert/strict';

const baseUrl = new URL(process.env.SASHA_STAGING_BASE_URL || 'https://localhost:8443');
const username = String(process.env.SASHA_STAGING_USERNAME || '').trim();
const password = String(process.env.SASHA_STAGING_PASSWORD || '');
if (baseUrl.protocol !== 'https:') throw new Error('Staging validation requires HTTPS.');
if (!username || !password) {
  throw new Error('SASHA_STAGING_USERNAME and SASHA_STAGING_PASSWORD are required.');
}
if (process.env.SASHA_STAGING_ALLOW_SELF_SIGNED === 'true') {
  if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
    throw new Error('Self-signed TLS bypass is allowed only for local staging.');
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function request(path, options = {}, cookie = '') {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('Cookie', cookie);
  return fetch(new URL(path, baseUrl), { ...options, headers, redirect: 'manual' });
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
    'X-File-Name': encodeURIComponent('staging-policy.jpg')
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
  secureCookie: true,
  attachmentScan: upload.item.scanDetail,
  attachmentDownload: 'ok'
}, null, 2));
