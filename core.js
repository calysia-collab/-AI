(function initializeSashaCore(global) {
  'use strict';

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function safeParseJSON(rawValue, fallbackValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return clone(fallbackValue);
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.warn('Stored data could not be parsed.', error);
      return clone(fallbackValue);
    }
  }

  function readStorage(storage, key, fallbackValue) {
    try {
      return safeParseJSON(storage.getItem(key), fallbackValue);
    } catch (error) {
      console.warn(`Unable to read storage key "${key}".`, error);
      return clone(fallbackValue);
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to write storage key "${key}".`, error);
      return false;
    }
  }

  function removeStorage(storage, key) {
    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Unable to remove storage key "${key}".`, error);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeExternalUrl(value, allowedHosts = []) {
    try {
      const parsed = new URL(String(value));
      if (parsed.protocol !== 'https:') return null;
      if (allowedHosts.length && !allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  function createId(prefix) {
    const randomId = global.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${randomId}`;
  }

  function asArray(value, fallbackValue = []) {
    return Array.isArray(value) ? value : clone(fallbackValue);
  }

  function normalizeCustomer(customer) {
    return {
      id: customer.id || createId('customer'),
      name: String(customer.name || '').trim(),
      phone: String(customer.phone || '').trim(),
      email: String(customer.email || '').trim(),
      birthday: String(customer.birthday || ''),
      ownerUserId: String(customer.ownerUserId || '').trim(),
      owner: String(customer.owner || '').trim(),
      stage: String(customer.stage || '新名單'),
      nextFollowUp: String(customer.nextFollowUp || ''),
      needs: String(customer.needs || '').trim(),
      note: String(customer.note || '').trim(),
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
      version: Number(customer.version || 1)
    };
  }

  function normalizePolicy(policy) {
    return {
      id: policy.id || createId('policy'),
      customerId: policy.customerId || null,
      customer: String(policy.customer || '').trim(),
      company: String(policy.company || '').trim(),
      policyNumber: String(policy.policyNumber || '').trim(),
      type: String(policy.type || '').trim(),
      startDate: String(policy.startDate || ''),
      paymentYears: String(policy.paymentYears || '').trim(),
      coverage: String(policy.coverage || '').trim(),
      premium: String(policy.premium || '').trim(),
      summary: String(policy.summary || '').trim(),
      updated: String(policy.updated || ''),
      createdAt: policy.createdAt || new Date().toISOString(),
      updatedAt: policy.updatedAt || new Date().toISOString(),
      version: Number(policy.version || 1)
    };
  }

  function normalizeEvent(event) {
    return {
      id: event.id || createId('event'),
      customerId: event.customerId || null,
      title: String(event.title || '').trim(),
      date: String(event.date || ''),
      time: String(event.time || ''),
      category: String(event.category || 'meeting'),
      reminder: String(event.reminder || '15 分鐘前'),
      detail: String(event.detail || '').trim(),
      note: String(event.note || '').trim(),
      status: ['scheduled', 'completed', 'cancelled'].includes(event.status) ? event.status : 'scheduled',
      createdAt: event.createdAt || new Date().toISOString(),
      updatedAt: event.updatedAt || new Date().toISOString(),
      version: Number(event.version || 1)
    };
  }

  global.SashaCore = Object.freeze({
    asArray,
    clone,
    createId,
    escapeHTML,
    normalizeCustomer,
    normalizeEvent,
    normalizePolicy,
    readStorage,
    removeStorage,
    safeExternalUrl,
    safeParseJSON,
    writeStorage
  });
})(globalThis);
