import { randomUUID } from 'node:crypto';

import {
  validateCustomerPayload,
  validateEventPayload,
  validatePolicyPayload,
  validateTeamStatePayload
} from './validation.mjs';

const bodyLimit = 2 * 1024 * 1024;
const importBodyLimit = 25 * 1024 * 1024;
const importLimit = 500;

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > bodyLimit) {
      const error = new Error('REQUEST_BODY_TOO_LARGE');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('INVALID_JSON');
    error.statusCode = 400;
    throw error;
  }
}

async function readBinaryBody(request, maximumBytes = importBodyLimit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('REQUEST_BODY_TOO_LARGE');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendCsv(response, statusCode, body, fileName, headers = {}) {
  const content = Buffer.from(`\uFEFF${String(body || '')}`, 'utf8');
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Content-Length': content.length,
    'Content-Type': 'text/csv; charset=utf-8',
    ...headers
  });
  response.end(content);
}

function requireJson(request, response, headers) {
  if ((request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return true;
  }
  sendJson(response, 415, { error: 'CONTENT_TYPE_MUST_BE_JSON' }, headers);
  return false;
}

function encodeCursor(item) {
  return Buffer.from(JSON.stringify({
    id: item.id,
    updatedAt: item.updatedAt
  }), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!cursor.id || !cursor.updatedAt) throw new Error('missing cursor fields');
    return {
      id: String(cursor.id),
      updatedAt: String(cursor.updatedAt)
    };
  } catch {
    const error = new Error('INVALID_CURSOR');
    error.statusCode = 400;
    throw error;
  }
}

function requestId(request) {
  const provided = String(request.headers['x-request-id'] || '').trim();
  return /^[A-Za-z0-9._:-]{1,100}$/.test(provided) ? provided : randomUUID();
}

function expectedVersion(request) {
  const value = String(request.headers['if-match'] || '').trim();
  const match = value.match(/^(?:W\/)?"?(?:[^"]*-v)?(\d+)"?$/);
  return match ? Number(match[1]) : null;
}

function itemEtag(resourceName, item) {
  return `W/"${resourceName}-${item.id}-v${item.version}"`;
}

function validationError(response, validation, headers) {
  sendJson(response, 422, {
    error: 'VALIDATION_FAILED',
    details: validation.errors
  }, headers);
}

function mutationResult(response, result, headers, resourceName) {
  if (result.notFound) {
    sendJson(response, 404, { error: 'NOT_FOUND' }, headers);
    return;
  }
  if (result.conflict) {
    sendJson(response, 409, {
      error: 'VERSION_CONFLICT',
      item: result.item || null
    }, result.item
      ? { ...headers, ETag: itemEtag(resourceName, result.item) }
      : headers);
    return;
  }
  sendJson(response, 200, result, result.item
    ? { ...headers, ETag: itemEtag(resourceName, result.item) }
    : headers);
}

function resourceConfiguration(database, session, advisorAccessUserId, resourceName) {
  const configurations = {
    customers: {
      create: (item) => database.createOrganizationCustomer(
        session.organizationId,
        session.id,
        item,
        advisorAccessUserId
      ),
      get: (id) => database.getOrganizationCustomer(
        session.organizationId,
        id,
        advisorAccessUserId
      ),
      update: (id, item, version) => database.updateOrganizationCustomer(
        session.organizationId,
        session.id,
        id,
        item,
        version,
        advisorAccessUserId
      ),
      validate: validateCustomerPayload
    },
    policies: {
      create: (item) => database.createOrganizationPolicy(
        session.organizationId,
        session.id,
        item,
        advisorAccessUserId
      ),
      get: (id) => database.getOrganizationPolicy(
        session.organizationId,
        id,
        advisorAccessUserId
      ),
      update: (id, item, version) => database.updateOrganizationPolicy(
        session.organizationId,
        session.id,
        id,
        item,
        version,
        advisorAccessUserId
      ),
      validate: validatePolicyPayload
    },
    events: {
      create: (item) => database.createOrganizationEvent(
        session.organizationId,
        session.id,
        item,
        advisorAccessUserId
      ),
      get: (id) => database.getOrganizationEvent(
        session.organizationId,
        id,
        advisorAccessUserId
      ),
      update: (id, item, version) => database.updateOrganizationEvent(
        session.organizationId,
        session.id,
        id,
        item,
        version,
        advisorAccessUserId
      ),
      validate: validateEventPayload
    }
  };
  return configurations[resourceName] || null;
}

function pageOptions(request, session, resourceName) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const archivedValue = requestUrl.searchParams.get('archived') || 'active';
  const archived = ['owner', 'manager'].includes(session.role)
    && ['active', 'all', 'only'].includes(archivedValue)
    ? archivedValue
    : 'active';
  const sort = requestUrl.searchParams.get('sort') || '-updatedAt';
  if (!['updatedAt', '-updatedAt'].includes(sort)) {
    const error = new Error('INVALID_SORT');
    error.statusCode = 400;
    throw error;
  }
  const filterNames = {
    customers: ['ownerUserId', 'stage'],
    policies: ['company', 'customerId', 'type'],
    events: ['category', 'customerId', 'status']
  }[resourceName];
  const filters = {};
  for (const name of filterNames) {
    const value = requestUrl.searchParams.get(name);
    if (value) filters[name] = value;
  }
  return {
    archived,
    cursor: decodeCursor(requestUrl.searchParams.get('cursor')),
    filters,
    limit: requestUrl.searchParams.get('limit'),
    sortDirection: sort === 'updatedAt' ? 'asc' : 'desc'
  };
}

function normalizedImportItems(payload) {
  if (!Array.isArray(payload.items)) {
    return { error: 'items 必須是陣列' };
  }
  if (payload.items.length > importLimit) {
    return { error: `單次最多匯入 ${importLimit} 位客戶` };
  }
  return {
    items: payload.items.map((item) => ({
      ...item,
      id: item?.id || `customer-${randomUUID()}`
    }))
  };
}

function workspaceValidation(resourceName, payload) {
  const required = {
    contacts: ['contactType', 'value'],
    relationships: ['relationshipType', 'displayName'],
    interactions: ['interactionType', 'occurredAt', 'subject'],
    tasks: ['title'],
    documents: ['documentType', 'title'],
    consents: ['consentType', 'status'],
    coverages: ['coverageType'],
    parties: ['partyType', 'displayName']
  }[resourceName] || [];
  const errors = required
    .filter((name) => !String(payload?.[name] ?? '').trim())
    .map((name) => `${name} 為必填`);
  if (
    resourceName === 'contacts'
    && !['phone', 'email', 'address', 'other'].includes(payload?.contactType)
  ) {
    errors.push('聯絡方式類型不正確');
  }
  if (
    resourceName === 'consents'
    && !['granted', 'withdrawn', 'expired'].includes(payload?.status)
  ) {
    errors.push('同意狀態不正確');
  }
  return { valid: errors.length === 0, errors };
}

async function previewCustomerImport(database, session, items) {
  const duplicateIds = new Set();
  const seenIds = new Set();
  const rows = [];
  for (const [index, item] of items.entries()) {
    const validation = validateCustomerPayload(item);
    const duplicateInFile = seenIds.has(String(item.id));
    seenIds.add(String(item.id));
    const duplicateInDatabase = validation.valid
      ? Boolean(await database.getOrganizationCustomer(session.organizationId, item.id))
      : false;
    if (duplicateInFile || duplicateInDatabase) duplicateIds.add(String(item.id));
    rows.push({
      row: index + 1,
      id: item.id,
      name: item.name || '',
      valid: validation.valid && !duplicateInFile && !duplicateInDatabase,
      duplicate: duplicateInFile || duplicateInDatabase,
      errors: [
        ...validation.errors,
        ...(duplicateInFile ? ['匯入內容中的客戶 id 重複'] : []),
        ...(duplicateInDatabase ? ['客戶 id 已存在'] : [])
      ]
    });
  }
  return {
    duplicateIds: [...duplicateIds],
    invalid: rows.filter((row) => !row.valid).length,
    ready: rows.filter((row) => row.valid).length,
    rows,
    total: rows.length
  };
}

export async function handleV1Api({
  advisorAccessUserId,
  database,
  importJobService,
  ocrService,
  pathname,
  request,
  response,
  securityHeaders,
  session
}) {
  if (!pathname.startsWith('/api/v1')) return false;
  const id = requestId(request);
  const headers = { ...securityHeaders, 'X-Request-ID': id };

  try {
    if (pathname === '/api/v1' && request.method === 'GET') {
      sendJson(response, 200, {
        name: '莎莎保險助理工作台 API',
        version: 'v1',
        resources: [
          'customers',
          'policies',
          'events',
          'customer-workspace',
          'import-jobs',
          'search',
          'ocr-jobs'
        ],
        pagination: 'cursor',
        compatibilityState: '/api/state'
      }, headers);
      return true;
    }

    if (pathname === '/api/v1/status' && request.method === 'GET') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
        return true;
      }
      sendJson(response, 200, {
        migration: await database.phase2MigrationReport(),
        workflowMigration: await database.workflowMigrationReport(),
        revision: await database.getOrganizationRevision(session.organizationId),
        version: 'v1'
      }, headers);
      return true;
    }

    if (pathname === '/api/v1/team-state') {
      if (request.method === 'GET') {
        const state = await database.getOrganizationState(
          session.organizationId,
          advisorAccessUserId
        );
        sendJson(response, 200, {
          revision: state.revision,
          teamGoal: state.teamGoal,
          teamMembers: state.teamMembers,
          teamTasks: state.teamTasks
        }, headers);
        return true;
      }
      if (request.method === 'PUT') {
        if (!['owner', 'manager'].includes(session.role)) {
          sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
          return true;
        }
        if (!requireJson(request, response, headers)) return true;
        const payload = await readJsonBody(request);
        const validation = validateTeamStatePayload(payload);
        if (!validation.valid) {
          validationError(response, validation, headers);
          return true;
        }
        const result = await database.replaceOrganizationTeamState(
          session.organizationId,
          session.id,
          payload,
          payload.expectedRevision
        );
        if (result.conflict) {
          sendJson(response, 409, {
            error: 'REVISION_CONFLICT',
            revision: result.revision
          }, headers);
          return true;
        }
        sendJson(response, 200, {
          revision: result.revision,
          status: 'saved'
        }, headers);
        return true;
      }
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
      return true;
    }

    if (pathname === '/api/v1/search' && request.method === 'GET') {
      const requestUrl = new URL(request.url || '/', 'http://localhost');
      const query = String(requestUrl.searchParams.get('q') || '').trim();
      if (query.length < 2) {
        sendJson(response, 422, {
          error: 'VALIDATION_FAILED',
          details: ['搜尋文字至少需要 2 個字元']
        }, headers);
        return true;
      }
      sendJson(response, 200, {
        items: await database.searchOrganization(
          session.organizationId,
          query,
          advisorAccessUserId,
          requestUrl.searchParams.get('limit')
        ),
        query
      }, headers);
      return true;
    }

    const workspaceMatch = pathname.match(
      /^\/api\/v1\/customers\/([^/]+)\/(workspace|contacts|relationships|interactions|tasks|documents|consents)(?:\/([^/]+))?$/
    );
    if (workspaceMatch) {
      const customerId = decodeURIComponent(workspaceMatch[1]);
      const resourceName = workspaceMatch[2];
      const recordId = workspaceMatch[3]
        ? decodeURIComponent(workspaceMatch[3])
        : null;
      if (resourceName === 'workspace' && request.method === 'GET' && !recordId) {
        sendJson(response, 200, {
          workspace: await database.getCustomerWorkspace(
            session.organizationId,
            customerId,
            advisorAccessUserId
          )
        }, headers);
        return true;
      }
      if (resourceName === 'workspace') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
        return true;
      }
      if (request.method === 'GET' && !recordId) {
        sendJson(response, 200, {
          items: await database.listCustomerWorkspaceRecords(
            resourceName,
            session.organizationId,
            customerId,
            advisorAccessUserId
          )
        }, headers);
        return true;
      }
      if (request.method === 'POST' && !recordId) {
        if (!requireJson(request, response, headers)) return true;
        const payload = await readJsonBody(request);
        const validation = workspaceValidation(resourceName, payload);
        if (!validation.valid) {
          validationError(response, validation, headers);
          return true;
        }
        const result = await database.createCustomerWorkspaceRecord(
          resourceName,
          session.organizationId,
          session.id,
          customerId,
          payload,
          advisorAccessUserId
        );
        sendJson(response, 201, result, {
          ...headers,
          ETag: itemEtag(resourceName, result.item)
        });
        return true;
      }
      if (['PUT', 'PATCH'].includes(request.method || '') && recordId) {
        if (!requireJson(request, response, headers)) return true;
        const version = expectedVersion(request);
        if (!version) {
          sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
          return true;
        }
        const payload = await readJsonBody(request);
        const validation = workspaceValidation(resourceName, payload);
        if (!validation.valid) {
          validationError(response, validation, headers);
          return true;
        }
        mutationResult(
          response,
          await database.updateCustomerWorkspaceRecord(
            resourceName,
            session.organizationId,
            session.id,
            customerId,
            recordId,
            payload,
            version,
            advisorAccessUserId
          ),
          headers,
          resourceName
        );
        return true;
      }
      if (request.method === 'DELETE' && recordId) {
        const version = expectedVersion(request);
        if (!version) {
          sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
          return true;
        }
        mutationResult(
          response,
          await database.archiveCustomerWorkspaceRecord(
            resourceName,
            session.organizationId,
            session.id,
            customerId,
            recordId,
            version,
            advisorAccessUserId
          ),
          headers,
          resourceName
        );
        return true;
      }
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
      return true;
    }

    const policyWorkspaceMatch = pathname.match(
      /^\/api\/v1\/policies\/([^/]+)\/(coverages|parties)$/
    );
    if (policyWorkspaceMatch) {
      const policyId = decodeURIComponent(policyWorkspaceMatch[1]);
      const resourceName = policyWorkspaceMatch[2];
      if (request.method === 'GET') {
        sendJson(response, 200, {
          items: await database.listPolicyWorkspaceRecords(
            resourceName,
            session.organizationId,
            policyId,
            advisorAccessUserId
          )
        }, headers);
        return true;
      }
      if (request.method === 'POST') {
        if (!requireJson(request, response, headers)) return true;
        const payload = await readJsonBody(request);
        const validation = workspaceValidation(resourceName, payload);
        if (!validation.valid) {
          validationError(response, validation, headers);
          return true;
        }
        const result = await database.createPolicyWorkspaceRecord(
          resourceName,
          session.organizationId,
          session.id,
          policyId,
          payload,
          advisorAccessUserId
        );
        sendJson(response, 201, result, {
          ...headers,
          ETag: itemEtag(resourceName, result.item)
        });
        return true;
      }
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
      return true;
    }

    const importJobMatch = pathname.match(
      /^\/api\/v1\/import-jobs(?:\/([^/]+)(?:\/(errors))?)?$/
    );
    if (importJobMatch) {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
        return true;
      }
      const jobId = importJobMatch[1] ? decodeURIComponent(importJobMatch[1]) : null;
      const action = importJobMatch[2] || null;
      if (request.method === 'GET' && !jobId) {
        sendJson(response, 200, {
          items: await database.listImportJobs(session.organizationId)
        }, headers);
        return true;
      }
      if (request.method === 'GET' && jobId && !action) {
        const item = await database.getImportJob(session.organizationId, jobId);
        sendJson(response, item ? 200 : 404, item ? { item } : { error: 'NOT_FOUND' }, headers);
        return true;
      }
      if (request.method === 'GET' && jobId && action === 'errors') {
        const payload = await database.getImportJobPayload(session.organizationId, jobId);
        if (!payload) {
          sendJson(response, 404, { error: 'NOT_FOUND' }, headers);
        } else if (!payload.errorCsv) {
          sendJson(response, 404, { error: 'IMPORT_HAS_NO_ERRORS' }, headers);
        } else {
          sendCsv(response, 200, payload.errorCsv, `import-errors-${jobId}.csv`, headers);
        }
        return true;
      }
      if (request.method === 'POST' && !jobId) {
        const contentType = String(request.headers['content-type'] || '').toLowerCase();
        const format = contentType.includes('spreadsheetml')
          ? 'xlsx'
          : contentType.includes('csv')
            ? 'csv'
            : '';
        if (!format) {
          sendJson(response, 415, { error: 'IMPORT_FORMAT_MUST_BE_CSV_OR_XLSX' }, headers);
          return true;
        }
        let fileName = String(request.headers['x-file-name'] || `customers.${format}`);
        try {
          fileName = decodeURIComponent(fileName);
        } catch {
          fileName = `customers.${format}`;
        }
        const item = await importJobService.create({
          organizationId: session.organizationId,
          actorUserId: session.id,
          fileName,
          format,
          buffer: await readBinaryBody(request),
          defaultOwnerUserId: session.role === 'advisor' ? session.id : '',
          defaultOwner: session.role === 'advisor' ? session.displayName : ''
        });
        sendJson(response, 202, { item }, headers);
        return true;
      }
      if (request.method === 'DELETE' && jobId && !action) {
        const item = await database.requestImportJobCancellation(
          session.organizationId,
          jobId
        );
        sendJson(response, item ? 202 : 404, item ? { item } : { error: 'NOT_FOUND' }, headers);
        return true;
      }
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
      return true;
    }

    const ocrMatch = pathname.match(
      /^\/api\/v1\/ocr\/jobs(?:\/([^/]+)(?:\/(approve|fields)(?:\/([^/]+))?)?)?$/
    );
    if (ocrMatch) {
      if (!ocrService) {
        sendJson(response, 503, { error: 'OCR_SERVICE_UNAVAILABLE' }, headers);
        return true;
      }
      const jobId = ocrMatch[1] ? decodeURIComponent(ocrMatch[1]) : null;
      const action = ocrMatch[2] || null;
      const fieldId = ocrMatch[3] ? decodeURIComponent(ocrMatch[3]) : null;
      if (request.method === 'GET' && !jobId) {
        const requestUrl = new URL(request.url || '/', 'http://localhost');
        sendJson(response, 200, {
          items: await database.listOcrJobs(
            session.organizationId,
            requestUrl.searchParams.get('customerId')
          ),
          provider: ocrService.provider
        }, headers);
        return true;
      }
      if (request.method === 'GET' && jobId && !action) {
        const item = await database.getOcrJob(session.organizationId, jobId);
        sendJson(response, item ? 200 : 404, item ? { item } : { error: 'NOT_FOUND' }, headers);
        return true;
      }
      if (request.method === 'POST' && !jobId) {
        if (!requireJson(request, response, headers)) return true;
        const payload = await readJsonBody(request);
        if (!payload.attachmentId || !payload.customerId) {
          validationError(response, {
            errors: ['attachmentId 與 customerId 為必填']
          }, headers);
          return true;
        }
        const item = await ocrService.create({
          organizationId: session.organizationId,
          actorUserId: session.id,
          attachmentId: payload.attachmentId,
          customerId: payload.customerId,
          accessUserId: advisorAccessUserId
        });
        sendJson(response, 202, { item }, headers);
        return true;
      }
      if (request.method === 'PATCH' && jobId && action === 'fields' && fieldId) {
        if (!requireJson(request, response, headers)) return true;
        const version = expectedVersion(request);
        if (!version) {
          sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
          return true;
        }
        const payload = await readJsonBody(request);
        mutationResult(
          response,
          await database.correctOcrField(
            session.organizationId,
            session.id,
            jobId,
            fieldId,
            payload.value,
            version
          ),
          headers,
          'ocr-field'
        );
        return true;
      }
      if (request.method === 'POST' && jobId && action === 'approve') {
        mutationResult(
          response,
          await ocrService.approve({
            organizationId: session.organizationId,
            actorUserId: session.id,
            jobId,
            accessUserId: advisorAccessUserId
          }),
          headers,
          'ocr-job'
        );
        return true;
      }
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
      return true;
    }

    const importMatch = pathname.match(/^\/api\/v1\/customers\/import(?:\/(preview))?$/);
    if (importMatch && request.method === 'POST') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
        return true;
      }
      if (!requireJson(request, response, headers)) return true;
      const normalized = normalizedImportItems(await readJsonBody(request));
      if (normalized.error) {
        sendJson(response, 422, {
          error: 'VALIDATION_FAILED',
          details: [normalized.error]
        }, headers);
        return true;
      }
      const preview = await previewCustomerImport(database, session, normalized.items);
      if (importMatch[1] === 'preview') {
        await database.recordOrganizationApiAudit(
          session.organizationId,
          session.id,
          'import_preview',
          'customer',
          null,
          { requestId: id, ready: preview.ready, total: preview.total }
        );
        sendJson(response, 200, preview, headers);
        return true;
      }

      const imported = [];
      const failed = [];
      for (const [index, item] of normalized.items.entries()) {
        const row = preview.rows[index];
        if (!row.valid) {
          failed.push(row);
          continue;
        }
        try {
          const result = await database.createOrganizationCustomer(
            session.organizationId,
            session.id,
            item
          );
          imported.push(result.item);
        } catch (error) {
          failed.push({
            ...row,
            valid: false,
            errors: [error?.code === '23505' ? '客戶 id 已存在' : '資料寫入失敗']
          });
        }
      }
      await database.recordOrganizationApiAudit(
        session.organizationId,
        session.id,
        'import',
        'customer',
        null,
        {
          failed: failed.length,
          imported: imported.length,
          requestId: id,
          total: normalized.items.length
        }
      );
      sendJson(response, failed.length ? 207 : 201, {
        failed,
        imported,
        status: failed.length ? 'partially_imported' : 'imported'
      }, headers);
      return true;
    }

    const exportMatch = pathname.match(/^\/api\/v1\/exports\/(customers|policies|events)$/);
    if (exportMatch && request.method === 'GET') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
        return true;
      }
      const resourceName = exportMatch[1];
      const page = await database.listOrganizationResourcePage(
        resourceName,
        session.organizationId,
        null,
        pageOptions(request, session, resourceName)
      );
      const nextCursor = page.hasMore && page.items.length
        ? encodeCursor(page.items.at(-1))
        : null;
      await database.recordOrganizationApiAudit(
        session.organizationId,
        session.id,
        'export',
        resourceName.slice(0, -1),
        null,
        { count: page.items.length, requestId: id }
      );
      sendJson(response, 200, {
        exportedAt: new Date().toISOString(),
        items: page.items,
        nextCursor,
        resource: resourceName
      }, headers);
      return true;
    }

    const resourceMatch = pathname.match(
      /^\/api\/v1\/(customers|policies|events)(?:\/([^/]+))?(?:\/(restore))?$/
    );
    if (!resourceMatch) {
      sendJson(response, 404, { error: 'NOT_FOUND' }, headers);
      return true;
    }
    const resourceName = resourceMatch[1];
    const resourceId = resourceMatch[2] ? decodeURIComponent(resourceMatch[2]) : null;
    const action = resourceMatch[3] || null;
    const configuration = resourceConfiguration(
      database,
      session,
      advisorAccessUserId,
      resourceName
    );

    if (request.method === 'GET' && !resourceId) {
      const page = await database.listOrganizationResourcePage(
        resourceName,
        session.organizationId,
        advisorAccessUserId,
        pageOptions(request, session, resourceName)
      );
      sendJson(response, 200, {
        items: page.items,
        nextCursor: page.hasMore && page.items.length
          ? encodeCursor(page.items.at(-1))
          : null,
        revision: await database.getOrganizationRevision(session.organizationId)
      }, headers);
      return true;
    }

    if (request.method === 'GET' && resourceId && !action) {
      const item = await configuration.get(resourceId);
      sendJson(response, item ? 200 : 404, item
        ? {
            item,
            revision: await database.getOrganizationRevision(session.organizationId)
          }
        : { error: 'NOT_FOUND' }, item
        ? { ...headers, ETag: itemEtag(resourceName, item) }
        : headers);
      return true;
    }

    if (request.method === 'POST' && !resourceId) {
      if (!requireJson(request, response, headers)) return true;
      const payload = await readJsonBody(request);
      let item = {
        ...payload,
        id: payload.id || `${resourceName.slice(0, -1)}-${randomUUID()}`
      };
      if (resourceName === 'customers' && advisorAccessUserId) {
        item = {
          ...item,
          owner: session.displayName,
          ownerUserId: session.id
        };
      }
      const validation = configuration.validate(item);
      if (!validation.valid) {
        validationError(response, validation, headers);
        return true;
      }
      const result = await configuration.create(item);
      sendJson(response, 201, result, {
        ...headers,
        ETag: itemEtag(resourceName, result.item)
      });
      return true;
    }

    if (['PUT', 'PATCH'].includes(request.method || '') && resourceId && !action) {
      if (!requireJson(request, response, headers)) return true;
      const version = expectedVersion(request);
      if (!version) {
        sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
        return true;
      }
      const current = await configuration.get(resourceId);
      if (!current) {
        sendJson(response, 404, { error: 'NOT_FOUND' }, headers);
        return true;
      }
      const payload = await readJsonBody(request);
      let item = request.method === 'PATCH'
        ? { ...current, ...payload, id: resourceId }
        : { ...payload, id: resourceId };
      if (resourceName === 'customers' && advisorAccessUserId) {
        item = {
          ...item,
          owner: session.displayName,
          ownerUserId: session.id
        };
      }
      const validation = configuration.validate(item);
      if (!validation.valid) {
        validationError(response, validation, headers);
        return true;
      }
      mutationResult(
        response,
        await configuration.update(resourceId, item, version),
        headers,
        resourceName
      );
      return true;
    }

    if (request.method === 'DELETE' && resourceId && !action) {
      const version = expectedVersion(request);
      if (!version) {
        sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
        return true;
      }
      mutationResult(
        response,
        await database.setOrganizationResourceArchived(
          resourceName,
          session.organizationId,
          session.id,
          resourceId,
          version,
          true,
          advisorAccessUserId,
          { requestId: id }
        ),
        headers,
        resourceName
      );
      return true;
    }

    if (request.method === 'POST' && resourceId && action === 'restore') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, headers);
        return true;
      }
      const version = expectedVersion(request);
      if (!version) {
        sendJson(response, 428, { error: 'IF_MATCH_REQUIRED' }, headers);
        return true;
      }
      mutationResult(
        response,
        await database.setOrganizationResourceArchived(
          resourceName,
          session.organizationId,
          session.id,
          resourceId,
          version,
          false,
          null,
          { requestId: id }
        ),
        headers,
        resourceName
      );
      return true;
    }

    sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, headers);
    return true;
  } catch (error) {
    const message = String(error?.message || '');
    if (error?.statusCode) {
      sendJson(response, error.statusCode, { error: message }, headers);
    } else if (message.includes('CUSTOMER_ACCESS_DENIED')) {
      sendJson(response, 403, { error: 'CUSTOMER_ACCESS_DENIED' }, headers);
    } else if (message.includes('INVALID_CUSTOMER_OWNER')) {
      sendJson(response, 422, { error: 'INVALID_CUSTOMER_OWNER' }, headers);
    } else if (
      message.includes('IMPORT_NAME_COLUMN_REQUIRED')
      || message.includes('IMPORT_HAS_NO_ROWS')
      || message.includes('IMPORT_ROW_LIMIT_EXCEEDED')
    ) {
      sendJson(response, 422, { error: message }, headers);
    } else if (
      message.includes('INVALID_XLSX')
      || message.includes('XLSX_')
      || message.includes('UNSUPPORTED_XLSX')
    ) {
      sendJson(response, 422, { error: 'INVALID_XLSX_FILE' }, headers);
    } else if (
      message.includes('OCR_ATTACHMENT_NOT_CLEAN')
      || message.includes('OCR_CUSTOMER_MISMATCH')
    ) {
      sendJson(response, 409, { error: message }, headers);
    } else if (
      message.includes('FOREIGN KEY constraint failed')
      || message.includes('CUSTOMER_NOT_IN_ORGANIZATION')
      || error?.code === '23503'
    ) {
      sendJson(response, 409, { error: 'RESOURCE_IN_USE' }, headers);
    } else if (message.includes('UNIQUE constraint failed') || error?.code === '23505') {
      sendJson(response, 409, { error: 'DUPLICATE_ID' }, headers);
    } else {
      console.error('Versioned API operation failed.', error);
      sendJson(response, 500, { error: 'INTERNAL_ERROR' }, headers);
    }
    return true;
  }
}
