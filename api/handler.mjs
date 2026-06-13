import { randomUUID } from 'node:crypto';

import {
  createAuthService,
  hashPassword,
  validateManagedUserPayload,
  validatePasswordPayload
} from './auth.mjs';
import {
  validateCustomerPayload,
  validateEventPayload,
  validatePolicyPayload,
  validateStatePayload
} from './validation.mjs';

const bodyLimit = 2 * 1024 * 1024;
const attachmentBodyLimit = 10 * 1024 * 1024;

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
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

async function readBinaryBody(request, maximumBytes = attachmentBodyLimit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error('Attachment too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function decodeHeader(value, fallback = '') {
  if (!value) return fallback;
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function requireJson(request, response, securityHeaders) {
  if ((request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return true;
  sendJson(response, 415, { error: 'CONTENT_TYPE_MUST_BE_JSON' }, securityHeaders);
  return false;
}

function sendCaughtError(response, error, securityHeaders, context) {
  if (error?.statusCode) {
    sendJson(response, error.statusCode, {
      error: error.statusCode === 400 ? 'INVALID_JSON' : 'REQUEST_BODY_TOO_LARGE'
    }, securityHeaders);
    return;
  }
  console.error(context, error);
  sendJson(response, 500, { error: 'INTERNAL_ERROR' }, securityHeaders);
}

function sendMutationResult(response, result, securityHeaders) {
  if (result.notFound) {
    sendJson(response, 404, { error: 'NOT_FOUND' }, securityHeaders);
    return;
  }
  if (result.conflict) {
    sendJson(response, 409, {
      error: 'VERSION_CONFLICT',
      item: result.item || null
    }, securityHeaders);
    return;
  }
  sendJson(response, 200, result, securityHeaders);
}

export function createApiHandler(database, securityHeaders, authOptions = {}) {
  const auth = createAuthService(database, authOptions);
  const attachmentStorage = authOptions.attachmentStorage || null;
  const metrics = {
    startedAt: Date.now(),
    apiRequests: 0,
    apiErrors: 0,
    successfulMutations: 0
  };

  return async function handleApi(request, response, pathname) {
    if (!pathname.startsWith('/api/')) return false;
    metrics.apiRequests += 1;
    response.once('finish', () => {
      if (response.statusCode >= 400) metrics.apiErrors += 1;
      if (['POST', 'PUT', 'DELETE'].includes(request.method || '') && response.statusCode < 400) {
        metrics.successfulMutations += 1;
      }
    });

    if (pathname === '/api/health' && request.method === 'GET') {
      try {
        sendJson(response, 200, {
          status: 'ok',
          database: 'available',
          databaseEngine: database.engine || 'sqlite',
          revision: await database.getRevision(),
          uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
          timestamp: new Date().toISOString()
        }, securityHeaders);
      } catch (error) {
        console.error('Database health check failed.', error);
        sendJson(response, 503, {
          status: 'degraded',
          database: 'unavailable',
          databaseEngine: database.engine || 'unknown',
          timestamp: new Date().toISOString()
        }, securityHeaders);
      }
      return true;
    }

    if (pathname === '/api/auth/status' && request.method === 'GET') {
      sendJson(response, 200, await auth.status(request), securityHeaders);
      return true;
    }

    if (pathname === '/api/auth/setup' && request.method === 'POST') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.setup(await readJsonBody(request), request);
        const headers = result.cookie ? { 'Set-Cookie': result.cookie } : {};
        const { statusCode, cookie, ...payload } = result;
        sendJson(response, statusCode, payload, { ...securityHeaders, ...headers });
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'Initial account setup failed.');
      }
      return true;
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.login(await readJsonBody(request), request);
        const headers = result.cookie ? { 'Set-Cookie': result.cookie } : {};
        const { statusCode, cookie, ...payload } = result;
        sendJson(response, statusCode, payload, { ...securityHeaders, ...headers });
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'Login failed unexpectedly.');
      }
      return true;
    }

    const session = await auth.getSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'AUTHENTICATION_REQUIRED' }, {
        ...securityHeaders,
        'Set-Cookie': auth.clearSessionCookie(request)
      });
      return true;
    }
    const advisorAccessUserId = session.role === 'advisor' ? session.id : null;

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      if (request.headers['x-csrf-token'] !== session.csrfToken) {
        sendJson(response, 403, { error: 'CSRF_TOKEN_INVALID' }, securityHeaders);
        return true;
      }
      const result = await auth.logout(request);
      sendJson(response, 200, { status: 'signed_out' }, {
        ...securityHeaders,
        'Set-Cookie': result.cookie
      });
      return true;
    }

    const mutationRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method || '');
    if (mutationRequest && request.headers['x-csrf-token'] !== session.csrfToken) {
      sendJson(response, 403, { error: 'CSRF_TOKEN_INVALID' }, securityHeaders);
      return true;
    }

    if (pathname === '/api/auth/change-password' && request.method === 'POST') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.changePassword(await readJsonBody(request), request, session);
        const headers = result.cookie ? { 'Set-Cookie': result.cookie } : {};
        const { statusCode, cookie, ...payload } = result;
        sendJson(response, statusCode, payload, { ...securityHeaders, ...headers });
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'Password change failed.');
      }
      return true;
    }

    if (pathname === '/api/auth/mfa/setup' && request.method === 'POST') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.beginMfaSetup(await readJsonBody(request), session);
        const { statusCode, ...payload } = result;
        sendJson(response, statusCode, payload, securityHeaders);
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'MFA setup failed.');
      }
      return true;
    }

    if (pathname === '/api/auth/mfa/confirm' && request.method === 'POST') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.confirmMfaSetup(await readJsonBody(request), session);
        const { statusCode, ...payload } = result;
        sendJson(response, statusCode, payload, securityHeaders);
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'MFA confirmation failed.');
      }
      return true;
    }

    if (pathname === '/api/auth/mfa' && request.method === 'DELETE') {
      try {
        if (!requireJson(request, response, securityHeaders)) return true;
        const result = await auth.disableMfa(await readJsonBody(request), session);
        const { statusCode, signedOut, ...payload } = result;
        sendJson(response, statusCode, payload, signedOut
          ? { ...securityHeaders, 'Set-Cookie': auth.clearSessionCookie(request) }
          : securityHeaders);
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'MFA disable failed.');
      }
      return true;
    }

    if (mutationRequest && session.role === 'viewer') {
      sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, securityHeaders);
      return true;
    }

    const attachmentMatch = pathname.match(/^\/api\/attachments(?:\/([^/]+))?$/);
    if (attachmentMatch) {
      if (!attachmentStorage) {
        sendJson(response, 503, { error: 'ATTACHMENT_STORAGE_UNAVAILABLE' }, securityHeaders);
        return true;
      }
      const attachmentId = attachmentMatch[1]
        ? decodeURIComponent(attachmentMatch[1])
        : null;
      try {
        if (request.method === 'GET' && !attachmentId) {
          const requestUrl = new URL(request.url || '/api/attachments', 'http://localhost');
          const items = await database.listOrganizationAttachments(
            session.organizationId,
            advisorAccessUserId,
            requestUrl.searchParams.get('limit')
          );
          sendJson(response, 200, { items }, securityHeaders);
          return true;
        }

        if (request.method === 'GET' && attachmentId) {
          const item = await database.getOrganizationAttachment(
            session.organizationId,
            attachmentId,
            advisorAccessUserId
          );
          if (!item) {
            sendJson(response, 404, { error: 'NOT_FOUND' }, securityHeaders);
            return true;
          }
          const requestUrl = new URL(request.url || '/', 'http://localhost');
          if (!attachmentStorage.verifyDownloadToken(requestUrl.searchParams.get('token'), item)) {
            sendJson(response, 403, { error: 'DOWNLOAD_TOKEN_INVALID' }, securityHeaders);
            return true;
          }
          if (item.status !== 'clean') {
            sendJson(response, 423, { error: 'ATTACHMENT_QUARANTINED' }, securityHeaders);
            return true;
          }
          const body = await attachmentStorage.read(item);
          const encodedFilename = encodeURIComponent(item.originalName || 'policy-image')
            .replaceAll("'", '%27');
          response.writeHead(200, {
            ...securityHeaders,
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
            'Content-Length': String(body.length),
            'Content-Type': item.mediaType,
            'X-Content-Type-Options': 'nosniff'
          });
          response.end(body);
          return true;
        }

        if (request.method === 'POST' && !attachmentId) {
          if ((request.headers['content-type'] || '').toLowerCase() !== 'application/octet-stream') {
            sendJson(response, 415, { error: 'CONTENT_TYPE_MUST_BE_OCTET_STREAM' }, securityHeaders);
            return true;
          }
          const id = `attachment-${randomUUID()}`;
          const stored = await attachmentStorage.store({
            attachmentId: id,
            organizationId: session.organizationId,
            originalName: decodeHeader(request.headers['x-file-name'], 'policy-image'),
            buffer: await readBinaryBody(request)
          });
          let result;
          try {
            result = await database.createOrganizationAttachment(
              session.organizationId,
              session.id,
              {
                ...stored,
                customerId: decodeHeader(request.headers['x-customer-id']) || null,
                policyId: decodeHeader(request.headers['x-policy-id']) || null
              },
              advisorAccessUserId
            );
          } catch (error) {
            await attachmentStorage.remove({
              ...stored,
              organizationId: session.organizationId
            }).catch(() => {});
            throw error;
          }
          const item = result.item;
          sendJson(response, item.status === 'clean' ? 201 : 202, {
            item,
            revision: result.revision,
            downloadUrl: item.status === 'clean'
              ? `/api/attachments/${encodeURIComponent(item.id)}?token=${encodeURIComponent(
                attachmentStorage.createDownloadToken(item)
              )}`
              : null
          }, securityHeaders);
          return true;
        }

        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, securityHeaders);
      } catch (error) {
        const message = String(error?.message || '');
        if (error?.statusCode === 413 || message === 'ATTACHMENT_TOO_LARGE') {
          sendJson(response, 413, { error: 'ATTACHMENT_TOO_LARGE' }, securityHeaders);
        } else if (message === 'EMPTY_ATTACHMENT') {
          sendJson(response, 400, { error: 'EMPTY_ATTACHMENT' }, securityHeaders);
        } else if (message === 'UNSUPPORTED_ATTACHMENT_TYPE') {
          sendJson(response, 415, { error: 'UNSUPPORTED_ATTACHMENT_TYPE' }, securityHeaders);
        } else if (['CUSTOMER_ACCESS_DENIED', 'POLICY_NOT_IN_ORGANIZATION'].includes(message)) {
          sendJson(response, 403, { error: 'ATTACHMENT_SCOPE_DENIED' }, securityHeaders);
        } else {
          sendCaughtError(response, error, securityHeaders, 'Attachment operation failed.');
        }
      }
      return true;
    }

    if (pathname === '/api/metrics' && request.method === 'GET') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, securityHeaders);
        return true;
      }
      const state = await database.getOrganizationState(session.organizationId);
      sendJson(response, 200, {
        startedAt: new Date(metrics.startedAt).toISOString(),
        uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
        apiRequests: metrics.apiRequests,
        apiErrors: metrics.apiErrors,
        successfulMutations: metrics.successfulMutations,
        revision: state.revision,
        records: {
          customers: state.customers.length,
          policies: state.policies.length,
          events: state.events.length,
          teamMembers: state.teamMembers.length,
          teamTasks: state.teamTasks.length
        },
        memory: {
          rssBytes: process.memoryUsage().rss,
          heapUsedBytes: process.memoryUsage().heapUsed
        }
      }, securityHeaders);
      return true;
    }

    if (pathname === '/api/audit' && request.method === 'GET') {
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, securityHeaders);
        return true;
      }
      const requestUrl = new URL(request.url || '/api/audit', 'http://localhost');
      sendJson(response, 200, {
        items: await database.listOrganizationAuditLogs(
          session.organizationId,
          requestUrl.searchParams.get('limit')
        ),
        revision: await database.getOrganizationRevision(session.organizationId)
      }, securityHeaders);
      return true;
    }

    const userMatch = pathname.match(/^\/api\/users(?:\/([^/]+)(?:\/(reset-password))?)?$/);
    if (userMatch) {
      const userId = userMatch[1] ? decodeURIComponent(userMatch[1]) : null;
      const action = userMatch[2] || null;
      if (!['owner', 'manager'].includes(session.role)) {
        sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, securityHeaders);
        return true;
      }

      try {
        if (request.method === 'GET' && !userId) {
          sendJson(response, 200, {
            items: await database.listOrganizationUsers(session.organizationId)
          }, securityHeaders);
          return true;
        }

        if (session.role !== 'owner') {
          sendJson(response, 403, { error: 'OWNER_PERMISSION_REQUIRED' }, securityHeaders);
          return true;
        }

        if (request.method === 'POST' && !userId) {
          if (!requireJson(request, response, securityHeaders)) return true;
          const validation = validateManagedUserPayload(await readJsonBody(request));
          if (!validation.valid) {
            sendJson(response, 422, {
              error: 'VALIDATION_FAILED',
              details: validation.errors
            }, securityHeaders);
            return true;
          }
          const password = await hashPassword(validation.value.password);
          const item = await database.createOrganizationUser(
            session.organizationId,
            session.id,
            {
              id: `user-${randomUUID()}`,
              displayName: validation.value.displayName,
              username: validation.value.username,
              role: validation.value.role,
              passwordHash: password.hash,
              passwordSalt: password.salt
            }
          );
          sendJson(response, 201, { item }, securityHeaders);
          return true;
        }

        if (request.method === 'PUT' && userId && !action) {
          if (!requireJson(request, response, securityHeaders)) return true;
          if (userId === session.id) {
            sendJson(response, 409, { error: 'CANNOT_CHANGE_CURRENT_OWNER' }, securityHeaders);
            return true;
          }
          const payload = await readJsonBody(request);
          const current = await database.getOrganizationUser(session.organizationId, userId);
          if (!current) {
            sendJson(response, 404, { error: 'NOT_FOUND' }, securityHeaders);
            return true;
          }
          const validation = validateManagedUserPayload({
            displayName: payload.displayName || current.displayName,
            username: current.username,
            role: payload.role || current.role,
            active: payload.active === undefined ? current.active : payload.active
          }, { passwordRequired: false });
          if (!validation.valid) {
            sendJson(response, 422, {
              error: 'VALIDATION_FAILED',
              details: validation.errors
            }, securityHeaders);
            return true;
          }
          const result = await database.updateOrganizationUser(
            session.organizationId,
            session.id,
            userId,
            {
              displayName: validation.value.displayName,
              role: validation.value.role,
              active: validation.value.active
            }
          );
          if (result.protectedOwner) {
            sendJson(response, 409, { error: 'OWNER_ACCOUNT_PROTECTED' }, securityHeaders);
          } else {
            sendMutationResult(response, result, securityHeaders);
          }
          return true;
        }

        if (request.method === 'POST' && userId && action === 'reset-password') {
          if (!requireJson(request, response, securityHeaders)) return true;
          const payload = await readJsonBody(request);
          const validation = validatePasswordPayload(payload);
          if (!validation.valid) {
            sendJson(response, 422, {
              error: 'VALIDATION_FAILED',
              details: validation.errors
            }, securityHeaders);
            return true;
          }
          const password = await hashPassword(validation.value.password);
          const result = await database.resetOrganizationUserPassword(
            session.organizationId,
            session.id,
            userId,
            password.hash,
            password.salt
          );
          sendMutationResult(response, result, securityHeaders);
          return true;
        }

        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, securityHeaders);
      } catch (error) {
        const message = String(error?.message || '');
        if (error?.statusCode) {
          sendCaughtError(response, error, securityHeaders, 'User management request failed.');
        } else if (message.includes('UNIQUE constraint failed') || error?.code === '23505') {
          sendJson(response, 409, { error: 'USERNAME_ALREADY_EXISTS' }, securityHeaders);
        } else {
          sendCaughtError(response, error, securityHeaders, 'User management operation failed.');
        }
      }
      return true;
    }

    if (pathname === '/api/state' && request.method === 'GET') {
      sendJson(
        response,
        200,
        await database.getOrganizationState(session.organizationId, advisorAccessUserId),
        securityHeaders
      );
      return true;
    }

    if (pathname === '/api/state' && request.method === 'PUT') {
      try {
        if (!['owner', 'manager'].includes(session.role)) {
          sendJson(response, 403, { error: 'INSUFFICIENT_PERMISSION' }, securityHeaders);
          return true;
        }
        if (!requireJson(request, response, securityHeaders)) return true;
        const payload = await readJsonBody(request);
        const validation = validateStatePayload(payload);
        if (!validation.valid) {
          sendJson(response, 422, { error: 'VALIDATION_FAILED', details: validation.errors }, securityHeaders);
          return true;
        }

        const result = await database.replaceOrganizationState(
          session.organizationId,
          session.id,
          payload,
          payload.expectedRevision
        );
        if (result.conflict) {
          sendJson(response, 409, {
            error: 'REVISION_CONFLICT',
            revision: result.revision
          }, securityHeaders);
          return true;
        }

        sendJson(response, 200, { status: 'saved', revision: result.revision }, securityHeaders);
      } catch (error) {
        sendCaughtError(response, error, securityHeaders, 'Whole-state update failed.');
      }
      return true;
    }

    const resourceMatch = pathname.match(/^\/api\/(customers|policies|events)(?:\/([^/]+))?$/);
    if (resourceMatch) {
      const resourceName = resourceMatch[1];
      const resourceId = resourceMatch[2] ? decodeURIComponent(resourceMatch[2]) : null;
      const config = {
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
          list: () => database.listOrganizationCustomers(
            session.organizationId,
            advisorAccessUserId
          ),
          remove: (id, version) => database.deleteOrganizationCustomer(
            session.organizationId,
            session.id,
            id,
            version,
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
          list: () => database.listOrganizationPolicies(
            session.organizationId,
            advisorAccessUserId
          ),
          remove: (id, version) => database.deleteOrganizationPolicy(
            session.organizationId,
            session.id,
            id,
            version,
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
          list: () => database.listOrganizationEvents(
            session.organizationId,
            advisorAccessUserId
          ),
          remove: (id, version) => database.deleteOrganizationEvent(
            session.organizationId,
            session.id,
            id,
            version,
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
      }[resourceName];

      try {
        if (request.method === 'GET' && !resourceId) {
          sendJson(response, 200, {
            items: await config.list(),
            revision: await database.getOrganizationRevision(session.organizationId)
          }, securityHeaders);
          return true;
        }

        if (request.method === 'GET' && resourceId) {
          const item = await config.get(resourceId);
          sendJson(response, item ? 200 : 404, item
            ? { item, revision: await database.getOrganizationRevision(session.organizationId) }
            : { error: 'NOT_FOUND' }, securityHeaders);
          return true;
        }

        if (request.method === 'POST' && !resourceId) {
          if (!requireJson(request, response, securityHeaders)) return true;
          const payload = await readJsonBody(request);
          let item = {
            ...payload,
            id: payload.id || `${resourceName.slice(0, -1)}-${randomUUID()}`
          };
          if (resourceName === 'customers' && advisorAccessUserId) {
            item = {
              ...item,
              ownerUserId: session.id,
              owner: session.displayName
            };
          }
          const validation = config.validate(item);
          if (!validation.valid) {
            sendJson(response, 422, { error: 'VALIDATION_FAILED', details: validation.errors }, securityHeaders);
            return true;
          }
          const result = await config.create(item);
          sendJson(response, 201, result, securityHeaders);
          return true;
        }

        if (request.method === 'PUT' && resourceId) {
          if (!requireJson(request, response, securityHeaders)) return true;
          const payload = await readJsonBody(request);
          let item = { ...payload, id: resourceId };
          if (resourceName === 'customers' && advisorAccessUserId) {
            item = {
              ...item,
              ownerUserId: session.id,
              owner: session.displayName
            };
          }
          const validation = config.validate(item);
          if (!validation.valid) {
            sendJson(response, 422, { error: 'VALIDATION_FAILED', details: validation.errors }, securityHeaders);
            return true;
          }
          sendMutationResult(
            response,
            await config.update(resourceId, item, payload.expectedVersion),
            securityHeaders
          );
          return true;
        }

        if (request.method === 'DELETE' && resourceId) {
          if (!requireJson(request, response, securityHeaders)) return true;
          const payload = await readJsonBody(request);
          sendMutationResult(
            response,
            await config.remove(resourceId, payload.expectedVersion),
            securityHeaders
          );
          return true;
        }

        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' }, securityHeaders);
      } catch (error) {
        const message = String(error?.message || '');
        if (error?.statusCode) {
          sendCaughtError(response, error, securityHeaders, 'API resource request failed.');
        } else if (message.includes('CUSTOMER_ACCESS_DENIED')) {
          sendJson(response, 403, { error: 'CUSTOMER_ACCESS_DENIED' }, securityHeaders);
        } else if (message.includes('INVALID_CUSTOMER_OWNER')) {
          sendJson(response, 422, { error: 'INVALID_CUSTOMER_OWNER' }, securityHeaders);
        } else if (
          message.includes('FOREIGN KEY constraint failed')
          || message.includes('CUSTOMER_NOT_IN_ORGANIZATION')
          || error?.code === '23503'
        ) {
          sendJson(response, 409, { error: 'RESOURCE_IN_USE' }, securityHeaders);
        } else if (message.includes('UNIQUE constraint failed') || error?.code === '23505') {
          sendJson(response, 409, { error: 'DUPLICATE_ID' }, securityHeaders);
        } else {
          sendCaughtError(response, error, securityHeaders, 'API resource operation failed.');
        }
      }
      return true;
    }

    sendJson(response, 404, { error: 'NOT_FOUND' }, securityHeaders);
    return true;
  };
}
