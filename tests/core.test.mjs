import test from 'node:test';
import assert from 'node:assert/strict';

await import('../core.js');
const core = globalThis.SashaCore;

test('safeParseJSON returns a clone of fallback data for invalid JSON', () => {
  const fallback = [{ id: 1 }];
  const originalWarn = console.warn;
  console.warn = () => {};
  const result = core.safeParseJSON('{broken', fallback);
  console.warn = originalWarn;
  assert.deepEqual(result, fallback);
  assert.notEqual(result, fallback);
});

test('escapeHTML protects text inserted into HTML templates', () => {
  assert.equal(
    core.escapeHTML('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
  );
});

test('safeExternalUrl only accepts HTTPS URLs', () => {
  assert.equal(core.safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(core.safeExternalUrl('http://example.com'), null);
  assert.equal(core.safeExternalUrl('https://example.com/path'), 'https://example.com/path');
});

test('normalizing a policy preserves all reviewed policy fields', () => {
  const policy = core.normalizePolicy({
    customerId: 'customer-1',
    customer: '王大明',
    company: '測試人壽',
    policyNumber: 'P-001',
    type: '醫療險',
    startDate: '2026-06-12',
    paymentYears: '20 年',
    coverage: '2,000,000',
    premium: '48,600',
    summary: '完整保障摘要'
  });

  assert.equal(policy.customerId, 'customer-1');
  assert.equal(policy.policyNumber, 'P-001');
  assert.equal(policy.startDate, '2026-06-12');
  assert.equal(policy.paymentYears, '20 年');
  assert.equal(policy.summary, '完整保障摘要');
});

test('storage reads recover from invalid data and writes report success', () => {
  const values = new Map([['broken', '{invalid']]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };

  const originalWarn = console.warn;
  console.warn = () => {};
  assert.deepEqual(core.readStorage(storage, 'broken', []), []);
  console.warn = originalWarn;
  assert.equal(core.writeStorage(storage, 'good', { ok: true }), true);
  assert.deepEqual(JSON.parse(values.get('good')), { ok: true });
});
