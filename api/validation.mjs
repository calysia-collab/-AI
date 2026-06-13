const limits = {
  customers: 10000,
  policies: 50000,
  events: 50000,
  teamMembers: 1000,
  teamTasks: 10000
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value, maximumLength = 500) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength;
}

function optionalText(value, maximumLength = 5000) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maximumLength);
}

function validateCollection(name, value) {
  if (!Array.isArray(value)) return `${name} 必須是陣列`;
  if (value.length > limits[name]) return `${name} 超過單次同步上限`;
  return null;
}

function validateUniqueIds(collectionName, collection, errors) {
  const ids = new Set();
  for (const item of collection) {
    const id = String(item?.id || '');
    if (!id) continue;
    if (ids.has(id)) errors.push(`${collectionName} id 重複：${id}`);
    ids.add(id);
  }
}

export function validateCustomerPayload(customer, { requireId = true } = {}) {
  const errors = [];
  if (!isRecord(customer)) return { valid: false, errors: ['客戶資料格式錯誤'] };
  if (requireId && !hasText(String(customer.id || ''), 100)) errors.push('客戶缺少有效的 id');
  if (!hasText(customer.name, 200)) errors.push('客戶姓名為必填且不可超過 200 字');
  if (!optionalText(customer.phone, 100)) errors.push('客戶電話格式過長');
  if (!optionalText(customer.email, 320)) errors.push('客戶 Email 格式過長');
  if (!optionalText(customer.ownerUserId, 100)) errors.push('負責顧問帳號格式過長');
  if (!optionalText(customer.owner, 200)) errors.push('負責顧問姓名格式過長');
  if (!optionalText(customer.needs, 2000)) errors.push('客戶保障需求不可超過 2,000 字');
  if (!optionalText(customer.note, 10000)) errors.push('客戶備註不可超過 10,000 字');
  return { valid: errors.length === 0, errors };
}

export function validatePolicyPayload(policy, { requireId = true } = {}) {
  const errors = [];
  if (!isRecord(policy)) return { valid: false, errors: ['保單資料格式錯誤'] };
  if (requireId && !hasText(String(policy.id || ''), 100)) errors.push('保單缺少有效的 id');
  if (!hasText(String(policy.customerId || ''), 100)) errors.push('保單必須關聯有效客戶');
  if (!hasText(policy.company, 300)) errors.push('保險公司為必填且不可超過 300 字');
  if (!optionalText(policy.policyNumber, 200)) errors.push('保單號碼不可超過 200 字');
  if (!optionalText(policy.summary, 20000)) errors.push('保障摘要不可超過 20,000 字');
  return { valid: errors.length === 0, errors };
}

export function validateEventPayload(event, { requireId = true } = {}) {
  const errors = [];
  if (!isRecord(event)) return { valid: false, errors: ['行程資料格式錯誤'] };
  if (requireId && !hasText(String(event.id || ''), 100)) errors.push('行程缺少有效的 id');
  if (!hasText(event.title, 500)) errors.push('行程標題為必填且不可超過 500 字');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.date || ''))) errors.push('行程日期格式必須為 YYYY-MM-DD');
  if (!/^\d{2}:\d{2}$/.test(String(event.time || ''))) errors.push('行程時間格式必須為 HH:MM');
  if (!['meeting', 'renewal', 'care', 'team'].includes(event.category)) errors.push('行程分類不正確');
  if (!['scheduled', 'completed', 'cancelled'].includes(event.status || 'scheduled')) errors.push('行程狀態不正確');
  if (!optionalText(event.note, 10000)) errors.push('行程備註不可超過 10,000 字');
  return { valid: errors.length === 0, errors };
}

export function validateStatePayload(payload) {
  if (!isRecord(payload)) return { valid: false, errors: ['資料格式錯誤'] };
  const errors = [];

  for (const name of Object.keys(limits)) {
    const error = validateCollection(name, payload[name]);
    if (error) errors.push(error);
  }

  if (errors.length) return { valid: false, errors };

  validateUniqueIds('客戶', payload.customers, errors);
  validateUniqueIds('保單', payload.policies, errors);
  validateUniqueIds('行程', payload.events, errors);
  validateUniqueIds('團隊成員', payload.teamMembers, errors);
  validateUniqueIds('團隊任務', payload.teamTasks, errors);

  const customerIds = new Set();
  for (const customer of payload.customers) {
    const validation = validateCustomerPayload(customer);
    errors.push(...validation.errors);
    if (!validation.valid) continue;
    const id = String(customer.id);
    customerIds.add(id);
  }

  for (const policy of payload.policies) {
    const validation = validatePolicyPayload(policy);
    errors.push(...validation.errors);
    if (!validation.valid) continue;
    if (!customerIds.has(String(policy.customerId))) {
      errors.push(`保單 ${policy.id} 沒有有效的關聯客戶`);
    }
  }

  for (const event of payload.events) {
    const validation = validateEventPayload(event);
    errors.push(...validation.errors);
    if (!validation.valid) continue;
    if (event.customerId && !customerIds.has(String(event.customerId))) {
      errors.push(`行程 ${event.id} 的關聯客戶不存在`);
    }
  }

  for (const member of payload.teamMembers) {
    if (!isRecord(member) || !hasText(String(member.id || ''), 100) || !hasText(member.name, 200)) {
      errors.push('團隊成員缺少有效的 id 或姓名');
    }
    if (Number(member.target || 0) < 0 || Number(member.closed || 0) < 0) {
      errors.push(`團隊成員 ${member.name || member.id || ''} 的件數不可小於 0`);
    }
  }

  for (const task of payload.teamTasks) {
    if (!isRecord(task) || !hasText(String(task.id || ''), 100) || !hasText(task.title, 1000)) {
      errors.push('團隊任務缺少有效的 id 或標題');
    }
  }

  if (!Number.isFinite(Number(payload.teamGoal || 0)) || Number(payload.teamGoal || 0) < 0) {
    errors.push('團隊目標必須是大於或等於 0 的數字');
  }

  return { valid: errors.length === 0, errors };
}
