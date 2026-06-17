import { runPostgresqlMigrations } from '../database/migrate-postgresql.mjs';
import {
  protectCustomerFields,
  protectEventFields,
  protectPolicyFields,
  unprotectCustomerFields,
  unprotectEventFields,
  unprotectPolicyFields
} from './protected-records.mjs';
import { createWorkflowRepository } from './workflow-repository.mjs';

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function nullableText(value) {
  const result = text(value).trim();
  return result || null;
}

function timestamp(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function dateValue(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function timeValue(value) {
  return value ? String(value).slice(0, 5) : '';
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    displayName: row.display_name,
    username: row.username,
    role: row.role,
    active: Boolean(row.active),
    mfaEnabled: Boolean(row.mfa_enabled),
    lockedUntil: timestamp(row.locked_until),
    lastLoginAt: timestamp(row.last_login_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at)
  };
}

function privateUser(row) {
  const user = publicUser(row);
  if (!user) return null;
  return {
    ...user,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    failedLoginAttempts: Number(row.failed_login_attempts || 0),
    mfaSecretCiphertext: row.mfa_secret_ciphertext,
    mfaLastCounter: row.mfa_last_counter === null ? null : Number(row.mfa_last_counter)
  };
}

function customer(row, dataProtection) {
  if (!row) return null;
  const protectedFields = unprotectCustomerFields(dataProtection, row);
  return {
    id: row.id,
    name: protectedFields.name,
    phone: protectedFields.phone,
    email: protectedFields.email,
    birthday: protectedFields.birthday,
    ownerUserId: row.owner_user_id || '',
    owner: row.owner,
    stage: row.stage,
    nextFollowUp: dateValue(row.next_follow_up),
    needs: protectedFields.needs,
    note: protectedFields.note,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    version: Number(row.version)
  };
}

function policy(row, dataProtection) {
  if (!row) return null;
  const protectedFields = unprotectPolicyFields(dataProtection, row);
  return {
    id: row.id,
    customerId: row.customer_id,
    customer: protectedFields.customer,
    company: row.company,
    policyNumber: protectedFields.policyNumber,
    type: row.type,
    startDate: protectedFields.startDate,
    paymentYears: row.payment_years,
    coverage: protectedFields.coverage,
    premium: protectedFields.premium,
    summary: protectedFields.summary,
    updated: row.updated_label,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    version: Number(row.version)
  };
}

function event(row, dataProtection) {
  if (!row) return null;
  const protectedFields = unprotectEventFields(dataProtection, row);
  return {
    id: row.id,
    customerId: row.customer_id,
    title: protectedFields.title,
    date: dateValue(row.event_date),
    time: timeValue(row.event_time),
    category: row.category,
    reminder: row.reminder,
    detail: protectedFields.detail,
    note: protectedFields.note,
    status: row.status,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    version: Number(row.version)
  };
}

function audit(row) {
  return {
    id: Number(row.id),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    actorUserId: row.actor_user_id || null,
    createdAt: timestamp(row.created_at)
  };
}

async function one(executor, sql, values = []) {
  return (await executor.query(sql, values)).rows[0] || null;
}

async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresqlDatabase(pool, { dataProtection = null } = {}) {
  const mapCustomer = (row) => customer(row, dataProtection);
  const mapPolicy = (row) => policy(row, dataProtection);
  const mapEvent = (row) => event(row, dataProtection);
  async function getRevision(executor = pool) {
    const row = await one(executor, "SELECT value FROM app_meta WHERE key = 'revision'");
    return Number(row?.value || 0);
  }

  async function incrementRevision(client) {
    const row = await one(client, `
      UPDATE app_meta
      SET value = ((value::bigint) + 1)::text
      WHERE key = 'revision'
      RETURNING value
    `);
    return Number(row.value);
  }

  async function getOrganizationRevision(organizationId, executor = pool, lock = false) {
    await executor.query(`
      INSERT INTO organization_revisions (organization_id, revision)
      VALUES ($1, 0)
      ON CONFLICT (organization_id) DO NOTHING
    `, [text(organizationId)]);
    const row = await one(
      executor,
      `SELECT revision FROM organization_revisions WHERE organization_id = $1${lock ? ' FOR UPDATE' : ''}`,
      [text(organizationId)]
    );
    return Number(row?.revision || 0);
  }

  async function incrementOrganizationRevision(client, organizationId) {
    const row = await one(client, `
      UPDATE organization_revisions
      SET revision = revision + 1
      WHERE organization_id = $1
      RETURNING revision
    `, [text(organizationId)]);
    await incrementRevision(client);
    return Number(row.revision);
  }

  async function recordAudit(
    executor,
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId = null,
    metadata = {}
  ) {
    await executor.query(`
      INSERT INTO audit_logs (
        organization_id, actor_user_id, action, entity_type, entity_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [
      text(organizationId),
      nullableText(actorUserId),
      text(action),
      text(entityType),
      nullableText(entityId),
      JSON.stringify(metadata)
    ]);
  }

  async function runOrganizationMutation(organizationId, operation) {
    return transaction(pool, async (client) => {
      await getOrganizationRevision(organizationId, client, true);
      const result = await operation(client);
      if (result?.conflict || result?.notFound) return result;
      return {
        ...result,
        revision: await incrementOrganizationRevision(client, organizationId)
      };
    });
  }

  async function listOrganizationCustomersWithExecutor(
    organizationId,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    const result = await executor.query(
      scopedUserId
        ? `SELECT * FROM customers
           WHERE organization_id = $1 AND owner_user_id = $2 AND archived_at IS NULL
           ORDER BY updated_at DESC, id`
        : `SELECT * FROM customers
           WHERE organization_id = $1 AND archived_at IS NULL
           ORDER BY updated_at DESC, id`,
      scopedUserId
        ? [text(organizationId), scopedUserId]
        : [text(organizationId)]
    );
    return result.rows.map(mapCustomer);
  }

  async function listOrganizationCustomers(organizationId, accessUserId = null) {
    return listOrganizationCustomersWithExecutor(organizationId, accessUserId, pool);
  }

  async function getOrganizationCustomerWithExecutor(
    organizationId,
    id,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    return mapCustomer(await one(
      executor,
      scopedUserId
        ? `SELECT * FROM customers
           WHERE organization_id = $1 AND id = $2 AND owner_user_id = $3
             AND archived_at IS NULL`
        : `SELECT * FROM customers
           WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL`,
      scopedUserId
        ? [text(organizationId), text(id), scopedUserId]
        : [text(organizationId), text(id)]
    ));
  }

  async function getOrganizationCustomer(organizationId, id, accessUserId = null) {
    return getOrganizationCustomerWithExecutor(organizationId, id, accessUserId, pool);
  }

  async function listOrganizationPoliciesWithExecutor(
    organizationId,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    const result = await executor.query(
      scopedUserId
        ? `SELECT policies.* FROM policies
           JOIN customers
             ON customers.organization_id = policies.organization_id
             AND customers.id = policies.customer_id
           WHERE policies.organization_id = $1 AND customers.owner_user_id = $2
             AND policies.archived_at IS NULL
             AND customers.archived_at IS NULL
           ORDER BY policies.updated_at DESC, policies.id`
        : `SELECT policies.* FROM policies
           JOIN customers
             ON customers.organization_id = policies.organization_id
             AND customers.id = policies.customer_id
           WHERE policies.organization_id = $1
             AND policies.archived_at IS NULL
             AND customers.archived_at IS NULL
           ORDER BY policies.updated_at DESC, policies.id`,
      scopedUserId
        ? [text(organizationId), scopedUserId]
        : [text(organizationId)]
    );
    return result.rows.map(mapPolicy);
  }

  async function listOrganizationPolicies(organizationId, accessUserId = null) {
    return listOrganizationPoliciesWithExecutor(organizationId, accessUserId, pool);
  }

  async function getOrganizationPolicyWithExecutor(
    organizationId,
    id,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    return mapPolicy(await one(
      executor,
      scopedUserId
        ? `SELECT policies.* FROM policies
           JOIN customers
             ON customers.organization_id = policies.organization_id
             AND customers.id = policies.customer_id
           WHERE policies.organization_id = $1
             AND policies.id = $2
             AND customers.owner_user_id = $3
             AND policies.archived_at IS NULL
             AND customers.archived_at IS NULL`
        : `SELECT policies.* FROM policies
           JOIN customers
             ON customers.organization_id = policies.organization_id
             AND customers.id = policies.customer_id
           WHERE policies.organization_id = $1 AND policies.id = $2
             AND policies.archived_at IS NULL
             AND customers.archived_at IS NULL`,
      scopedUserId
        ? [text(organizationId), text(id), scopedUserId]
        : [text(organizationId), text(id)]
    ));
  }

  async function getOrganizationPolicy(organizationId, id, accessUserId = null) {
    return getOrganizationPolicyWithExecutor(organizationId, id, accessUserId, pool);
  }

  async function listOrganizationEventsWithExecutor(
    organizationId,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    const result = await executor.query(
      scopedUserId
        ? `SELECT events.* FROM events
           LEFT JOIN customers
             ON customers.organization_id = events.organization_id
             AND customers.id = events.customer_id
           WHERE events.organization_id = $1
             AND events.archived_at IS NULL
             AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
             AND (
               customers.owner_user_id = $2
               OR (events.customer_id IS NULL AND events.category = 'team')
             )
           ORDER BY events.event_date, events.event_time, events.id`
        : `SELECT events.* FROM events
           LEFT JOIN customers
             ON customers.organization_id = events.organization_id
             AND customers.id = events.customer_id
           WHERE events.organization_id = $1
             AND events.archived_at IS NULL
             AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
           ORDER BY events.event_date, events.event_time, events.id`,
      scopedUserId
        ? [text(organizationId), scopedUserId]
        : [text(organizationId)]
    );
    return result.rows.map(mapEvent);
  }

  async function listOrganizationEvents(organizationId, accessUserId = null) {
    return listOrganizationEventsWithExecutor(organizationId, accessUserId, pool);
  }

  async function getOrganizationEventWithExecutor(
    organizationId,
    id,
    accessUserId,
    executor
  ) {
    const scopedUserId = nullableText(accessUserId);
    return mapEvent(await one(
      executor,
      scopedUserId
        ? `SELECT events.* FROM events
           LEFT JOIN customers
             ON customers.organization_id = events.organization_id
             AND customers.id = events.customer_id
           WHERE events.organization_id = $1
             AND events.id = $2
             AND events.archived_at IS NULL
             AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
             AND (
               customers.owner_user_id = $3
               OR (events.customer_id IS NULL AND events.category = 'team')
             )`
        : `SELECT events.* FROM events
           LEFT JOIN customers
             ON customers.organization_id = events.organization_id
             AND customers.id = events.customer_id
           WHERE events.organization_id = $1 AND events.id = $2
             AND events.archived_at IS NULL
             AND (events.customer_id IS NULL OR customers.archived_at IS NULL)`,
      scopedUserId
        ? [text(organizationId), text(id), scopedUserId]
        : [text(organizationId), text(id)]
    ));
  }

  async function getOrganizationEvent(organizationId, id, accessUserId = null) {
    return getOrganizationEventWithExecutor(organizationId, id, accessUserId, pool);
  }

  async function getOrganizationState(organizationId, accessUserId = null) {
    const organization = text(organizationId);
    const [
      revision,
      customers,
      policies,
      events,
      membersResult,
      tasksResult,
      goalRow
    ] = await Promise.all([
      getOrganizationRevision(organization),
      listOrganizationCustomers(organization, accessUserId),
      listOrganizationPolicies(organization, accessUserId),
      listOrganizationEvents(organization, accessUserId),
      pool.query(
        `SELECT * FROM team_members
         WHERE organization_id = $1 AND archived_at IS NULL
         ORDER BY is_owner DESC, name`,
        [organization]
      ),
      pool.query(
        `SELECT * FROM team_tasks
         WHERE organization_id = $1 AND archived_at IS NULL
         ORDER BY done, due, id`,
        [organization]
      ),
      one(pool, `
        SELECT value FROM organization_settings
        WHERE organization_id = $1 AND key = 'teamGoal'
      `, [organization])
    ]);
    return {
      revision,
      customers,
      policies,
      events,
      teamMembers: membersResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        specialty: row.specialty,
        target: Number(row.target),
        closed: Number(row.closed),
        owner: Boolean(row.is_owner)
      })),
      teamTasks: tasksResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        owner: row.owner,
        due: row.due,
        done: Boolean(row.done)
      })),
      teamGoal: Number(goalRow?.value || 0)
    };
  }

  async function resolveOrganizationCustomerOwner(
    executor,
    organizationId,
    item,
    accessUserId = null,
    currentOwnerUserId = null
  ) {
    const ownerUserId = nullableText(item.ownerUserId);
    const scopedUserId = nullableText(accessUserId);
    if (scopedUserId && ownerUserId !== scopedUserId) {
      throw new Error('CUSTOMER_ACCESS_DENIED');
    }
    if (!ownerUserId) {
      return { ownerUserId: null, owner: text(item.owner) };
    }
    const ownerUser = await getOrganizationUser(organizationId, ownerUserId, executor);
    if (
      !ownerUser
      || ownerUser.role === 'viewer'
      || (!ownerUser.active && ownerUserId !== nullableText(currentOwnerUserId))
    ) {
      throw new Error('INVALID_CUSTOMER_OWNER');
    }
    return {
      ownerUserId,
      owner: ownerUser.displayName
    };
  }

  async function insertState(client, organizationId, state) {
    const organization = text(organizationId);
    const now = new Date().toISOString();
    for (const item of state.customers) {
      const assignedOwner = await resolveOrganizationCustomerOwner(
        client,
        organization,
        item
      );
      const protectedFields = protectCustomerFields(dataProtection, organization, item);
      await client.query(`
        INSERT INTO customers (
          id, organization_id, name, phone, email, birthday, owner_user_id, owner, stage,
          next_follow_up, needs, note, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `, [
        text(item.id), organization, protectedFields.name, protectedFields.phone,
        protectedFields.email, protectedFields.birthdayCiphertext,
        assignedOwner.ownerUserId, assignedOwner.owner,
        text(item.stage || '新名單'),
        nullableText(item.nextFollowUp), protectedFields.needs, protectedFields.note,
        Number(item.version || 1), item.createdAt || now, item.updatedAt || now
      ]);
    }
    for (const item of state.policies) {
      const protectedFields = protectPolicyFields(dataProtection, organization, item);
      await client.query(`
        INSERT INTO policies (
          id, organization_id, customer_id, customer_name, company, policy_number,
          type, start_date, payment_years, coverage, premium, summary, updated_label,
          version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
      `, [
        text(item.id), organization, text(item.customerId), protectedFields.customerName,
        text(item.company), protectedFields.policyNumber, text(item.type),
        protectedFields.startDateCiphertext, text(item.paymentYears), protectedFields.coverage,
        protectedFields.premium, protectedFields.summary, text(item.updated),
        Number(item.version || 1), item.createdAt || now, item.updatedAt || now
      ]);
    }
    for (const item of state.events) {
      const protectedFields = protectEventFields(dataProtection, organization, item);
      await client.query(`
        INSERT INTO events (
          id, organization_id, customer_id, title, event_date, event_time, category,
          reminder, detail, note, status, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `, [
        text(item.id), organization, nullableText(item.customerId), protectedFields.title,
        text(item.date), text(item.time), text(item.category),
        text(item.reminder || '15 分鐘前'), protectedFields.detail, protectedFields.note,
        text(item.status || 'scheduled'), Number(item.version || 1),
        item.createdAt || now, item.updatedAt || now
      ]);
    }
    for (const item of state.teamMembers) {
      await client.query(`
        INSERT INTO team_members (
          id, organization_id, name, role, specialty, target, closed, is_owner
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        text(item.id), organization, text(item.name), text(item.role),
        text(item.specialty), Number(item.target || 0), Number(item.closed || 0),
        Boolean(item.owner)
      ]);
    }
    for (const item of state.teamTasks) {
      await client.query(`
        INSERT INTO team_tasks (id, organization_id, title, owner, due, done)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        text(item.id), organization, text(item.title), text(item.owner),
        text(item.due), Boolean(item.done)
      ]);
    }
    await client.query(`
      INSERT INTO organization_settings (organization_id, key, value)
      VALUES ($1, 'teamGoal', $2)
      ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value
    `, [organization, String(Number(state.teamGoal || 0))]);
  }

  async function replaceOrganizationState(organizationId, actorUserId, state, expectedRevision) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const currentRevision = await getOrganizationRevision(organization, client, true);
      if (Number(expectedRevision) !== currentRevision) {
        return { conflict: true, revision: currentRevision };
      }
      await client.query('DELETE FROM policies WHERE organization_id = $1', [organization]);
      await client.query('DELETE FROM events WHERE organization_id = $1', [organization]);
      await client.query('DELETE FROM team_tasks WHERE organization_id = $1', [organization]);
      await client.query('DELETE FROM team_members WHERE organization_id = $1', [organization]);
      await client.query('DELETE FROM customers WHERE organization_id = $1', [organization]);
      await insertState(client, organization, state);
      await recordAudit(
        client,
        organization,
        actorUserId,
        'replace',
        'application_state',
        null,
        {
          customers: state.customers.length,
          policies: state.policies.length,
          events: state.events.length
        }
      );
      return {
        conflict: false,
        revision: await incrementOrganizationRevision(client, organization)
      };
    });
  }

  async function replaceOrganizationTeamState(
    organizationId,
    actorUserId,
    state,
    expectedRevision
  ) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const currentRevision = await getOrganizationRevision(organization, client, true);
      if (Number(expectedRevision) !== currentRevision) {
        return { conflict: true, revision: currentRevision };
      }
      await client.query('DELETE FROM team_tasks WHERE organization_id = $1', [organization]);
      await client.query('DELETE FROM team_members WHERE organization_id = $1', [organization]);
      for (const item of state.teamMembers) {
        await client.query(`
          INSERT INTO team_members (
            id, organization_id, name, role, specialty, target, closed, is_owner,
            version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, now(), now())
        `, [
          text(item.id), organization, text(item.name), text(item.role),
          text(item.specialty), Number(item.target || 0), Number(item.closed || 0),
          Boolean(item.owner)
        ]);
      }
      for (const item of state.teamTasks) {
        await client.query(`
          INSERT INTO team_tasks (
            id, organization_id, title, owner, due, done, version, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 1, now(), now())
        `, [
          text(item.id), organization, text(item.title), text(item.owner),
          text(item.due), Boolean(item.done)
        ]);
      }
      await client.query(`
        INSERT INTO organization_settings (organization_id, key, value)
        VALUES ($1, 'teamGoal', $2)
        ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value
      `, [organization, String(Number(state.teamGoal || 0))]);
      await recordAudit(
        client,
        organization,
        actorUserId,
        'replace',
        'team_state',
        null,
        {
          members: state.teamMembers.length,
          tasks: state.teamTasks.length
        }
      );
      return {
        conflict: false,
        revision: await incrementOrganizationRevision(client, organization)
      };
    });
  }

  async function createOrganizationCustomer(
    organizationId,
    actorUserId,
    item,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const now = new Date().toISOString();
      const assignedOwner = await resolveOrganizationCustomerOwner(
        client,
        organization,
        item,
        accessUserId
      );
      const protectedFields = protectCustomerFields(dataProtection, organization, item);
      await client.query(`
        INSERT INTO customers (
          id, organization_id, name, phone, email, birthday, owner_user_id, owner, stage,
          next_follow_up, needs, note, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, $14
        )
      `, [
        text(item.id), organization, protectedFields.name, protectedFields.phone,
        protectedFields.email, protectedFields.birthdayCiphertext,
        assignedOwner.ownerUserId, assignedOwner.owner,
        text(item.stage || '新名單'),
        nullableText(item.nextFollowUp), protectedFields.needs, protectedFields.note,
        item.createdAt || now, now
      ]);
      await recordAudit(client, organization, actorUserId, 'create', 'customer', item.id, {
        version: 1
      });
      return {
        item: await getOrganizationCustomerWithExecutor(
          organization,
          item.id,
          accessUserId,
          client
        )
      };
    });
  }

  async function updateOrganizationCustomer(
    organizationId,
    actorUserId,
    id,
    item,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationCustomerWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const assignedOwner = await resolveOrganizationCustomerOwner(
        client,
        organization,
        item,
        accessUserId,
        current.ownerUserId
      );
      const protectedFields = protectCustomerFields(
        dataProtection,
        organization,
        { ...item, id }
      );
      const result = await client.query(`
        UPDATE customers SET
          name = $1, phone = $2, email = $3, birthday = $4, owner_user_id = $5,
          owner = $6, stage = $7, next_follow_up = $8, needs = $9, note = $10,
          version = version + 1, updated_at = now()
        WHERE organization_id = $11 AND id = $12 AND version = $13
        RETURNING *
      `, [
        protectedFields.name, protectedFields.phone, protectedFields.email,
        protectedFields.birthdayCiphertext,
        assignedOwner.ownerUserId, assignedOwner.owner, text(item.stage || '新名單'),
        nullableText(item.nextFollowUp), protectedFields.needs, protectedFields.note,
        organization, text(id), Number(expectedVersion)
      ]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationCustomerWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      const relatedPolicies = await client.query(`
        SELECT id FROM policies WHERE organization_id = $1 AND customer_id = $2
      `, [organization, text(id)]);
      for (const relatedPolicy of relatedPolicies.rows) {
        const policyFields = protectPolicyFields(dataProtection, organization, {
          id: relatedPolicy.id,
          customer: item.name
        });
        await client.query(`
          UPDATE policies SET customer_name = $1
          WHERE organization_id = $2 AND customer_id = $3 AND id = $4
        `, [policyFields.customerName, organization, text(id), relatedPolicy.id]);
      }
      await recordAudit(client, organization, actorUserId, 'update', 'customer', id, {
        fromVersion: Number(expectedVersion),
        toVersion: Number(expectedVersion) + 1
      });
      await client.query(`
        DELETE FROM search_tokens
        WHERE organization_id = $1 AND (
          (entity_type = 'customer' AND entity_id = $2)
          OR customer_id = $2
        )
      `, [organization, text(id)]);
      return { item: mapCustomer(result.rows[0]) };
    });
  }

  async function deleteOrganizationCustomer(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationCustomerWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      await client.query(`
        UPDATE events SET customer_id = NULL
        WHERE organization_id = $1 AND customer_id = $2
      `, [organization, text(id)]);
      const result = await client.query(`
        DELETE FROM customers
        WHERE organization_id = $1 AND id = $2 AND version = $3
        RETURNING id
      `, [organization, text(id), Number(expectedVersion)]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationCustomerWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      await recordAudit(client, organization, actorUserId, 'delete', 'customer', id, {
        version: Number(expectedVersion)
      });
      return { deletedId: text(id) };
    });
  }

  async function requireOrganizationCustomer(
    client,
    organizationId,
    customerId,
    accessUserId = null
  ) {
    if (await getOrganizationCustomerWithExecutor(
      organizationId,
      customerId,
      accessUserId,
      client
    )) return;
    if (
      accessUserId
      && await getOrganizationCustomerWithExecutor(
        organizationId,
        customerId,
        null,
        client
      )
    ) {
      throw new Error('CUSTOMER_ACCESS_DENIED');
    }
    throw new Error('CUSTOMER_NOT_IN_ORGANIZATION');
  }

  async function createOrganizationPolicy(
    organizationId,
    actorUserId,
    item,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      await requireOrganizationCustomer(client, organization, item.customerId, accessUserId);
      const now = new Date().toISOString();
      const protectedFields = protectPolicyFields(dataProtection, organization, item);
      const result = await client.query(`
        INSERT INTO policies (
          id, organization_id, customer_id, customer_name, company, policy_number,
          type, start_date, payment_years, coverage, premium, summary, updated_label,
          version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15
        ) RETURNING *
      `, [
        text(item.id), organization, text(item.customerId), protectedFields.customerName,
        text(item.company), protectedFields.policyNumber, text(item.type),
        protectedFields.startDateCiphertext, text(item.paymentYears), protectedFields.coverage,
        protectedFields.premium, protectedFields.summary, text(item.updated),
        item.createdAt || now, now
      ]);
      await recordAudit(client, organization, actorUserId, 'create', 'policy', item.id, {
        customerId: text(item.customerId),
        version: 1
      });
      return { item: mapPolicy(result.rows[0]) };
    });
  }

  async function updateOrganizationPolicy(
    organizationId,
    actorUserId,
    id,
    item,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationPolicyWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      await requireOrganizationCustomer(client, organization, item.customerId, accessUserId);
      const protectedFields = protectPolicyFields(
        dataProtection,
        organization,
        { ...item, id }
      );
      const result = await client.query(`
        UPDATE policies SET
          customer_id = $1, customer_name = $2, company = $3, policy_number = $4,
          type = $5, start_date = $6, payment_years = $7, coverage = $8,
          premium = $9, summary = $10, updated_label = $11,
          version = version + 1, updated_at = now()
        WHERE organization_id = $12 AND id = $13 AND version = $14
        RETURNING *
      `, [
        text(item.customerId), protectedFields.customerName, text(item.company),
        protectedFields.policyNumber, text(item.type), protectedFields.startDateCiphertext,
        text(item.paymentYears), protectedFields.coverage, protectedFields.premium,
        protectedFields.summary, text(item.updated), organization, text(id),
        Number(expectedVersion)
      ]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationPolicyWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      await recordAudit(client, organization, actorUserId, 'update', 'policy', id, {
        fromVersion: Number(expectedVersion),
        toVersion: Number(expectedVersion) + 1
      });
      await client.query(`
        DELETE FROM search_tokens
        WHERE organization_id = $1 AND entity_type = 'policy' AND entity_id = $2
      `, [organization, text(id)]);
      return { item: mapPolicy(result.rows[0]) };
    });
  }

  async function deleteOrganizationPolicy(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationPolicyWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = await client.query(`
        DELETE FROM policies
        WHERE organization_id = $1 AND id = $2 AND version = $3
        RETURNING id
      `, [organization, text(id), Number(expectedVersion)]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationPolicyWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      await recordAudit(client, organization, actorUserId, 'delete', 'policy', id, {
        version: Number(expectedVersion)
      });
      return { deletedId: text(id) };
    });
  }

  async function createOrganizationEvent(
    organizationId,
    actorUserId,
    item,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      if (accessUserId && !item.customerId && item.category !== 'team') {
        throw new Error('CUSTOMER_ACCESS_DENIED');
      }
      if (item.customerId) {
        await requireOrganizationCustomer(
          client,
          organization,
          item.customerId,
          accessUserId
        );
      }
      const now = new Date().toISOString();
      const protectedFields = protectEventFields(dataProtection, organization, item);
      const result = await client.query(`
        INSERT INTO events (
          id, organization_id, customer_id, title, event_date, event_time, category,
          reminder, detail, note, status, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13
        ) RETURNING *
      `, [
        text(item.id), organization, nullableText(item.customerId), protectedFields.title,
        text(item.date), text(item.time), text(item.category),
        text(item.reminder || '15 分鐘前'), protectedFields.detail, protectedFields.note,
        text(item.status || 'scheduled'), item.createdAt || now, now
      ]);
      await recordAudit(client, organization, actorUserId, 'create', 'event', item.id, {
        status: text(item.status || 'scheduled'),
        version: 1
      });
      return { item: mapEvent(result.rows[0]) };
    });
  }

  async function updateOrganizationEvent(
    organizationId,
    actorUserId,
    id,
    item,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationEventWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      if (accessUserId && !item.customerId && item.category !== 'team') {
        throw new Error('CUSTOMER_ACCESS_DENIED');
      }
      if (item.customerId) {
        await requireOrganizationCustomer(
          client,
          organization,
          item.customerId,
          accessUserId
        );
      }
      const protectedFields = protectEventFields(
        dataProtection,
        organization,
        { ...item, id }
      );
      const result = await client.query(`
        UPDATE events SET
          customer_id = $1, title = $2, event_date = $3, event_time = $4,
          category = $5, reminder = $6, detail = $7, note = $8, status = $9,
          version = version + 1, updated_at = now()
        WHERE organization_id = $10 AND id = $11 AND version = $12
        RETURNING *
      `, [
        nullableText(item.customerId), protectedFields.title, text(item.date), text(item.time),
        text(item.category), text(item.reminder || '15 分鐘前'), protectedFields.detail,
        protectedFields.note, text(item.status || 'scheduled'), organization, text(id),
        Number(expectedVersion)
      ]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationEventWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      await recordAudit(client, organization, actorUserId, 'update', 'event', id, {
        fromVersion: Number(expectedVersion),
        toVersion: Number(expectedVersion) + 1,
        status: text(item.status || 'scheduled')
      });
      return { item: mapEvent(result.rows[0]) };
    });
  }

  async function deleteOrganizationEvent(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationEventWithExecutor(
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = await client.query(`
        DELETE FROM events
        WHERE organization_id = $1 AND id = $2 AND version = $3
        RETURNING id
      `, [organization, text(id), Number(expectedVersion)]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationEventWithExecutor(
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      await recordAudit(client, organization, actorUserId, 'delete', 'event', id, {
        version: Number(expectedVersion)
      });
      return { deletedId: text(id) };
    });
  }

  function phase2ResourceConfiguration(resourceName) {
    const configurations = {
      customers: {
        alias: 'customers',
        map: mapCustomer,
        table: 'customers'
      },
      policies: {
        alias: 'policies',
        map: mapPolicy,
        table: 'policies'
      },
      events: {
        alias: 'events',
        map: mapEvent,
        table: 'events'
      }
    };
    const configuration = configurations[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_RESOURCE');
    return configuration;
  }

  function addPostgresqlValue(values, value) {
    values.push(value);
    return `$${values.length}`;
  }

  async function listOrganizationResourcePage(
    resourceName,
    organizationId,
    accessUserId = null,
    {
      archived = 'active',
      cursor = null,
      filters = {},
      limit = 50,
      sortDirection = 'desc'
    } = {}
  ) {
    const configuration = phase2ResourceConfiguration(resourceName);
    const alias = configuration.alias;
    const values = [];
    const conditions = [
      `${alias}.organization_id = ${addPostgresqlValue(values, text(organizationId))}`
    ];
    const scopedUserId = nullableText(accessUserId);
    let from = `${configuration.table} AS ${alias}`;

    if (resourceName === 'policies') {
      from += ` JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id`;
      if (scopedUserId) {
        conditions.push(
          `customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}`
        );
      }
      if (archived === 'active') conditions.push('customers.archived_at IS NULL');
    } else if (resourceName === 'events') {
      from += ` LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id`;
      if (scopedUserId) {
        conditions.push(`(
          customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}
          OR (events.customer_id IS NULL AND events.category = 'team')
        )`);
      }
      if (archived === 'active') {
        conditions.push('(events.customer_id IS NULL OR customers.archived_at IS NULL)');
      }
    } else if (scopedUserId) {
      conditions.push(
        `customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}`
      );
    }

    if (archived === 'active') conditions.push(`${alias}.archived_at IS NULL`);
    if (archived === 'only') conditions.push(`${alias}.archived_at IS NOT NULL`);

    const allowedFilters = {
      customers: {
        ownerUserId: 'customers.owner_user_id',
        stage: 'customers.stage'
      },
      policies: {
        company: 'policies.company',
        customerId: 'policies.customer_id',
        type: 'policies.type'
      },
      events: {
        category: 'events.category',
        customerId: 'events.customer_id',
        status: 'events.status'
      }
    }[resourceName];
    for (const [name, column] of Object.entries(allowedFilters)) {
      const value = nullableText(filters[name]);
      if (!value) continue;
      conditions.push(`${column} = ${addPostgresqlValue(values, value)}`);
    }

    const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
    if (cursor?.updatedAt && cursor?.id) {
      const comparison = direction === 'ASC' ? '>' : '<';
      const timestampParameter = addPostgresqlValue(values, text(cursor.updatedAt));
      const idParameter = addPostgresqlValue(values, text(cursor.id));
      conditions.push(
        `(${alias}.updated_at ${comparison} ${timestampParameter}
          OR (${alias}.updated_at = ${timestampParameter} AND ${alias}.id > ${idParameter}))`
      );
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const limitParameter = addPostgresqlValue(values, safeLimit + 1);
    const result = await pool.query(`
      SELECT ${alias}.*
      FROM ${from}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${alias}.updated_at ${direction}, ${alias}.id ASC
      LIMIT ${limitParameter}
    `, values);
    return {
      hasMore: result.rows.length > safeLimit,
      items: result.rows.slice(0, safeLimit).map(configuration.map)
    };
  }

  async function getOrganizationResourceIncludingArchived(
    resourceName,
    organizationId,
    id,
    accessUserId = null,
    executor = pool
  ) {
    const configuration = phase2ResourceConfiguration(resourceName);
    const alias = configuration.alias;
    const values = [];
    const conditions = [
      `${alias}.organization_id = ${addPostgresqlValue(values, text(organizationId))}`,
      `${alias}.id = ${addPostgresqlValue(values, text(id))}`
    ];
    const scopedUserId = nullableText(accessUserId);
    let from = `${configuration.table} AS ${alias}`;
    if (resourceName === 'policies') {
      from += ` JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id`;
      if (scopedUserId) {
        conditions.push(
          `customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}`
        );
      }
    } else if (resourceName === 'events') {
      from += ` LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id`;
      if (scopedUserId) {
        conditions.push(`(
          customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}
          OR (events.customer_id IS NULL AND events.category = 'team')
        )`);
      }
    } else if (scopedUserId) {
      conditions.push(
        `customers.owner_user_id = ${addPostgresqlValue(values, scopedUserId)}`
      );
    }
    return configuration.map(await one(
      executor,
      `SELECT ${alias}.* FROM ${from} WHERE ${conditions.join(' AND ')}`,
      values
    ));
  }

  async function setOrganizationResourceArchived(
    resourceName,
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    archived,
    accessUserId = null,
    metadata = {}
  ) {
    const configuration = phase2ResourceConfiguration(resourceName);
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      const current = await getOrganizationResourceIncludingArchived(
        resourceName,
        organization,
        id,
        accessUserId,
        client
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) {
        return { conflict: true, item: current };
      }
      const result = await client.query(`
        UPDATE ${configuration.table}
        SET archived_at = $1, version = version + 1, updated_at = now()
        WHERE organization_id = $2 AND id = $3 AND version = $4
        RETURNING *
      `, [
        archived ? new Date().toISOString() : null,
        organization,
        text(id),
        Number(expectedVersion)
      ]);
      if (!result.rows.length) {
        return {
          conflict: true,
          item: await getOrganizationResourceIncludingArchived(
            resourceName,
            organization,
            id,
            accessUserId,
            client
          )
        };
      }
      if (resourceName === 'customers') {
        await client.query(`
          DELETE FROM search_tokens
          WHERE organization_id = $1 AND customer_id = $2
        `, [organization, text(id)]);
      } else if (resourceName === 'policies') {
        await client.query(`
          DELETE FROM search_tokens
          WHERE organization_id = $1 AND entity_type = 'policy' AND entity_id = $2
        `, [organization, text(id)]);
      }
      await recordAudit(
        client,
        organization,
        actorUserId,
        archived ? 'archive' : 'restore',
        resourceName.slice(0, -1),
        id,
        {
          ...metadata,
          fromVersion: Number(expectedVersion),
          toVersion: Number(expectedVersion) + 1
        }
      );
      return { item: configuration.map(result.rows[0]) };
    });
  }

  async function recordOrganizationApiAudit(
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId = null,
    metadata = {}
  ) {
    await recordAudit(
      pool,
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata
    );
  }

  async function countUsers() {
    const row = await one(pool, 'SELECT count(*)::bigint AS count FROM users');
    return Number(row.count);
  }

  async function getUserById(id, executor = pool) {
    return privateUser(await one(executor, `
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.id = $1
    `, [text(id)]));
  }

  async function getUserByUsername(username) {
    return privateUser(await one(pool, `
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE lower(users.username) = lower($1)
    `, [text(username)]));
  }

  async function createOrganization(input) {
    const now = new Date().toISOString();
    await transaction(pool, async (client) => {
      await client.query(
        'INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)',
        [text(input.id), text(input.name), now]
      );
      await client.query(`
        INSERT INTO organization_revisions (organization_id, revision) VALUES ($1, 0)
      `, [text(input.id)]);
    });
    return { id: text(input.id), name: text(input.name), createdAt: now };
  }

  async function createOrganizationOwner(input) {
    return transaction(pool, async (client) => {
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const count = await one(client, 'SELECT count(*)::bigint AS count FROM users');
      if (Number(count.count) > 0) throw new Error('SETUP_ALREADY_COMPLETED');
      const now = new Date().toISOString();
      await client.query(
        'INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)',
        [text(input.organizationId), text(input.organizationName), now]
      );
      await client.query(`
        INSERT INTO users (
          id, organization_id, display_name, username, password_hash, password_salt,
          role, active, created_at, updated_at
        ) VALUES ($1, $2, $3, lower($4), $5, $6, 'owner', true, $7, $7)
      `, [
        text(input.userId), text(input.organizationId), text(input.displayName),
        text(input.username), text(input.passwordHash), text(input.passwordSalt), now
      ]);
      await client.query(`
        INSERT INTO organization_revisions (organization_id, revision) VALUES ($1, 0)
      `, [text(input.organizationId)]);
      await recordAudit(
        client,
        input.organizationId,
        input.userId,
        'setup',
        'organization',
        input.organizationId,
        { ownerUserId: input.userId }
      );
      return { user: await getUserById(input.userId, client) };
    });
  }

  async function listOrganizationUsers(organizationId) {
    const result = await pool.query(`
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.organization_id = $1
      ORDER BY (users.role = 'owner') DESC, users.active DESC, users.display_name
    `, [text(organizationId)]);
    return result.rows.map(publicUser);
  }

  async function getOrganizationUser(organizationId, userId, executor = pool) {
    return publicUser(await one(executor, `
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.organization_id = $1 AND users.id = $2
    `, [text(organizationId), text(userId)]));
  }

  async function createOrganizationUser(organizationId, actorUserId, input) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const now = new Date().toISOString();
      await client.query(`
        INSERT INTO users (
          id, organization_id, display_name, username, password_hash, password_salt,
          role, active, created_at, updated_at
        ) VALUES ($1, $2, $3, lower($4), $5, $6, $7, true, $8, $8)
      `, [
        text(input.id), organization, text(input.displayName), text(input.username),
        text(input.passwordHash), text(input.passwordSalt), text(input.role || 'advisor'), now
      ]);
      await recordAudit(client, organization, actorUserId, 'create', 'user', input.id, {
        role: text(input.role || 'advisor')
      });
      return getOrganizationUser(organization, input.id, client);
    });
  }

  async function updateOrganizationUser(organizationId, actorUserId, userId, input) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const current = await getOrganizationUser(organization, userId, client);
      if (!current) return { notFound: true };
      if (current.role === 'owner') return { protectedOwner: true };
      const role = text(input.role || current.role);
      const active = input.active !== false;
      const result = await client.query(`
        UPDATE users SET display_name = $1, role = $2, active = $3, updated_at = now()
        WHERE organization_id = $4 AND id = $5
        RETURNING id
      `, [text(input.displayName || current.displayName), role, active, organization, text(userId)]);
      if (!result.rows.length) return { notFound: true };
      await client.query(`
        UPDATE customers SET owner = $1
        WHERE organization_id = $2 AND owner_user_id = $3
      `, [text(input.displayName || current.displayName), organization, text(userId)]);
      if (!active || role !== current.role) {
        await client.query('DELETE FROM sessions WHERE user_id = $1', [text(userId)]);
      }
      await recordAudit(client, organization, actorUserId, 'update', 'user', userId, {
        role,
        active
      });
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  async function updatePassword(organizationId, actorUserId, userId, passwordHash, passwordSalt, action) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const result = await client.query(`
        UPDATE users SET
          password_hash = $1, password_salt = $2, failed_login_attempts = 0,
          locked_until = NULL, updated_at = now()
        WHERE organization_id = $3 AND id = $4
        RETURNING id
      `, [text(passwordHash), text(passwordSalt), organization, text(userId)]);
      if (!result.rows.length) return { notFound: true };
      await client.query('DELETE FROM sessions WHERE user_id = $1', [text(userId)]);
      await recordAudit(client, organization, actorUserId, action, 'user', userId, {});
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  const resetOrganizationUserPassword = (
    organizationId,
    actorUserId,
    userId,
    passwordHash,
    passwordSalt
  ) => updatePassword(
    organizationId,
    actorUserId,
    userId,
    passwordHash,
    passwordSalt,
    'reset_password'
  );

  const changeOrganizationUserPassword = (
    organizationId,
    userId,
    passwordHash,
    passwordSalt
  ) => updatePassword(
    organizationId,
    userId,
    userId,
    passwordHash,
    passwordSalt,
    'change_password'
  );

  async function recoverOrganizationUser(
    organizationId,
    userId,
    passwordHash,
    passwordSalt,
    { disableMfa = false } = {}
  ) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const result = await client.query(`
        UPDATE users SET
          password_hash = $1, password_salt = $2, failed_login_attempts = 0,
          locked_until = NULL,
          mfa_secret_ciphertext = CASE WHEN $3 THEN NULL ELSE mfa_secret_ciphertext END,
          mfa_enabled = CASE WHEN $3 THEN false ELSE mfa_enabled END,
          mfa_last_counter = CASE WHEN $3 THEN NULL ELSE mfa_last_counter END,
          updated_at = now()
        WHERE organization_id = $4 AND id = $5 AND active = true
        RETURNING id
      `, [
        text(passwordHash),
        text(passwordSalt),
        Boolean(disableMfa),
        organization,
        text(userId)
      ]);
      if (!result.rows.length) return { notFound: true };
      if (disableMfa) {
        await client.query(
          'DELETE FROM user_recovery_codes WHERE user_id = $1',
          [text(userId)]
        );
      }
      await client.query('DELETE FROM sessions WHERE user_id = $1', [text(userId)]);
      await recordAudit(
        client,
        organization,
        userId,
        'emergency_recovery',
        'user',
        userId,
        { mfaDisabled: Boolean(disableMfa) }
      );
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  async function setOrganizationUserMfaPending(
    organizationId,
    userId,
    encryptedSecret,
    recoveryCodeHashes
  ) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const result = await client.query(`
        UPDATE users SET
          mfa_secret_ciphertext = $1, mfa_enabled = false, mfa_last_counter = NULL,
          updated_at = now()
        WHERE organization_id = $2 AND id = $3
        RETURNING id
      `, [text(encryptedSecret), organization, text(userId)]);
      if (!result.rows.length) return { notFound: true };
      await client.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [text(userId)]);
      for (const codeHash of recoveryCodeHashes) {
        await client.query(`
          INSERT INTO user_recovery_codes (user_id, code_hash)
          VALUES ($1, $2)
        `, [text(userId), text(codeHash)]);
      }
      await recordAudit(client, organization, userId, 'mfa_setup_started', 'user', userId, {
        recoveryCodeCount: recoveryCodeHashes.length
      });
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  async function enableOrganizationUserMfa(organizationId, userId, counter) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const result = await client.query(`
        UPDATE users SET mfa_enabled = true, mfa_last_counter = $1, updated_at = now()
        WHERE organization_id = $2 AND id = $3 AND mfa_secret_ciphertext IS NOT NULL
        RETURNING id
      `, [Number(counter), organization, text(userId)]);
      if (!result.rows.length) return { notFound: true };
      await recordAudit(client, organization, userId, 'mfa_enabled', 'user', userId, {});
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  async function disableOrganizationUserMfa(organizationId, userId) {
    const organization = text(organizationId);
    return transaction(pool, async (client) => {
      const result = await client.query(`
        UPDATE users SET
          mfa_secret_ciphertext = NULL, mfa_enabled = false, mfa_last_counter = NULL,
          updated_at = now()
        WHERE organization_id = $1 AND id = $2
        RETURNING id
      `, [organization, text(userId)]);
      if (!result.rows.length) return { notFound: true };
      await client.query('DELETE FROM user_recovery_codes WHERE user_id = $1', [text(userId)]);
      await client.query('DELETE FROM sessions WHERE user_id = $1', [text(userId)]);
      await recordAudit(client, organization, userId, 'mfa_disabled', 'user', userId, {});
      return { item: await getOrganizationUser(organization, userId, client) };
    });
  }

  async function consumeUserTotpCounter(userId, counter) {
    const result = await pool.query(`
      UPDATE users SET mfa_last_counter = $1, updated_at = now()
      WHERE id = $2 AND mfa_enabled = true
        AND (mfa_last_counter IS NULL OR mfa_last_counter < $1)
      RETURNING id
    `, [Number(counter), text(userId)]);
    return result.rows.length > 0;
  }

  async function consumeUserRecoveryCode(userId, codeHash) {
    const result = await pool.query(`
      UPDATE user_recovery_codes SET used_at = now()
      WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
      RETURNING id
    `, [text(userId), text(codeHash)]);
    return result.rows.length > 0;
  }

  async function createSession(session) {
    await pool.query(`
      INSERT INTO sessions (
        token_hash, user_id, csrf_token, created_at, last_seen_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      text(session.tokenHash), text(session.userId), text(session.csrfToken),
      session.createdAt, session.lastSeenAt, session.expiresAt
    ]);
  }

  async function getSession(hash) {
    const row = await one(pool, `
      SELECT
        sessions.token_hash, sessions.csrf_token, sessions.created_at,
        sessions.last_seen_at, sessions.expires_at,
        users.id, users.organization_id, organizations.name AS organization_name,
        users.display_name, users.username, users.role, users.active, users.mfa_enabled
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      JOIN organizations ON organizations.id = users.organization_id
      WHERE sessions.token_hash = $1
    `, [text(hash)]);
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      csrfToken: row.csrf_token,
      createdAt: timestamp(row.created_at),
      lastSeenAt: timestamp(row.last_seen_at),
      expiresAt: timestamp(row.expires_at),
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      displayName: row.display_name,
      username: row.username,
      role: row.role,
      active: Boolean(row.active),
      mfaEnabled: Boolean(row.mfa_enabled)
    };
  }

  async function touchSession(hash, value) {
    await pool.query('UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2', [
      value,
      text(hash)
    ]);
  }

  async function deleteSession(hash) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [text(hash)]);
  }

  async function deleteExpiredSessions(value) {
    await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [value]);
  }

  async function recordLoginFailure(userId, failures, lockedUntil) {
    await pool.query(`
      UPDATE users SET
        failed_login_attempts = $1, locked_until = $2, updated_at = now()
      WHERE id = $3
    `, [Number(failures || 0), nullableText(lockedUntil), text(userId)]);
  }

  async function recordLoginSuccess(userId, value) {
    await transaction(pool, async (client) => {
      await client.query(`
        UPDATE users SET
          failed_login_attempts = 0, locked_until = NULL, last_login_at = $1,
          updated_at = now()
        WHERE id = $2
      `, [value, text(userId)]);
      const user = await getUserById(userId, client);
      if (user) {
        await recordAudit(client, user.organizationId, user.id, 'login', 'user', user.id, {});
      }
    });
  }

  async function listOrganizationAuditLogs(organizationId, limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const result = await pool.query(`
      SELECT * FROM audit_logs
      WHERE organization_id = $1
      ORDER BY id DESC LIMIT $2
    `, [text(organizationId), safeLimit]);
    return result.rows.map(audit);
  }

  function attachment(row) {
    if (!row) return null;
    const originalName = dataProtection
      ? dataProtection.unprotectText(row.original_name, {
        organizationId: row.organization_id,
        entityType: 'attachment',
        entityId: row.id,
        field: 'originalName'
      })
      : row.original_name;
    return {
      id: row.id,
      organizationId: row.organization_id,
      uploadedBy: row.uploaded_by,
      customerId: row.customer_id || null,
      policyId: row.policy_id || null,
      originalName,
      mediaType: row.media_type,
      sizeBytes: Number(row.size_bytes),
      sha256: row.sha256,
      status: row.status,
      storageKey: row.storage_key,
      scanDetail: row.scan_detail,
      scannedAt: timestamp(row.scanned_at),
      createdAt: timestamp(row.created_at)
    };
  }

  async function getOrganizationAttachment(
    organizationId,
    id,
    accessUserId = null,
    executor = pool
  ) {
    const organization = text(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const row = await one(
      executor,
      scopedUserId
        ? `SELECT attachments.* FROM attachments
           LEFT JOIN customers
             ON customers.organization_id = attachments.organization_id
             AND customers.id = attachments.customer_id
           WHERE attachments.organization_id = $1
             AND attachments.id = $2
             AND (
               customers.owner_user_id = $3
               OR (attachments.customer_id IS NULL AND attachments.uploaded_by = $3)
             )`
        : 'SELECT * FROM attachments WHERE organization_id = $1 AND id = $2',
      scopedUserId
        ? [organization, text(id), scopedUserId]
        : [organization, text(id)]
    );
    return attachment(row);
  }

  async function listOrganizationAttachments(
    organizationId,
    accessUserId = null,
    limit = 100
  ) {
    const organization = text(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const result = await pool.query(
      scopedUserId
        ? `SELECT attachments.* FROM attachments
           LEFT JOIN customers
             ON customers.organization_id = attachments.organization_id
             AND customers.id = attachments.customer_id
           WHERE attachments.organization_id = $1
             AND (
               customers.owner_user_id = $2
               OR (attachments.customer_id IS NULL AND attachments.uploaded_by = $2)
             )
           ORDER BY attachments.created_at DESC
           LIMIT $3`
        : `SELECT * FROM attachments
           WHERE organization_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
      scopedUserId
        ? [organization, scopedUserId, safeLimit]
        : [organization, safeLimit]
    );
    return result.rows.map(attachment);
  }

  async function listAttachmentsForMaintenance() {
    const result = await pool.query('SELECT * FROM attachments ORDER BY created_at ASC');
    return result.rows.map(attachment);
  }

  async function createOrganizationAttachment(
    organizationId,
    actorUserId,
    item,
    accessUserId = null
  ) {
    const organization = text(organizationId);
    return runOrganizationMutation(organization, async (client) => {
      if (item.customerId) {
        await requireOrganizationCustomer(client, organization, item.customerId, accessUserId);
      }
      if (item.policyId) {
        const policyItem = await getOrganizationPolicyWithExecutor(
          organization,
          item.policyId,
          accessUserId,
          client
        );
        if (!policyItem) throw new Error('POLICY_NOT_IN_ORGANIZATION');
      }
      const originalName = dataProtection
        ? dataProtection.protectText(item.originalName, {
          organizationId: organization,
          entityType: 'attachment',
          entityId: item.id,
          field: 'originalName'
        })
        : text(item.originalName);
      const result = await client.query(`
        INSERT INTO attachments (
          id, organization_id, uploaded_by, customer_id, policy_id, original_name,
          media_type, size_bytes, sha256, status, storage_key, scan_detail, scanned_at,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `, [
        text(item.id), organization, text(actorUserId), nullableText(item.customerId),
        nullableText(item.policyId), originalName, text(item.mediaType),
        Number(item.sizeBytes), text(item.sha256), text(item.status), text(item.storageKey),
        text(item.scanDetail), nullableText(item.scannedAt),
        item.createdAt || new Date().toISOString()
      ]);
      await recordAudit(client, organization, actorUserId, 'create', 'attachment', item.id, {
        customerId: nullableText(item.customerId),
        mediaType: text(item.mediaType),
        sizeBytes: Number(item.sizeBytes),
        status: text(item.status)
      });
      return { item: attachment(result.rows[0]) };
    });
  }

  async function protectSensitiveData() {
    if (!dataProtection) {
      return { customers: 0, policies: 0, events: 0, attachments: 0, workflow: 0 };
    }
    return transaction(pool, async (client) => {
      const counts = {
        customers: 0,
        policies: 0,
        events: 0,
        attachments: 0,
        workflow: 0
      };
      for (const row of (await client.query('SELECT * FROM customers')).rows) {
        const fields = protectCustomerFields(dataProtection, row.organization_id, {
          ...row,
          birthday: row.birthday
        });
        await client.query(`
          UPDATE customers
          SET name = $1, phone = $2, email = $3, birthday = $4, needs = $5, note = $6
          WHERE id = $7
        `, [
          fields.name, fields.phone, fields.email, fields.birthdayCiphertext,
          fields.needs, fields.note, row.id
        ]);
        counts.customers += 1;
      }
      for (const row of (await client.query('SELECT * FROM policies')).rows) {
        const fields = protectPolicyFields(dataProtection, row.organization_id, {
          ...row,
          customerName: row.customer_name,
          policyNumber: row.policy_number,
          startDate: row.start_date
        });
        await client.query(`
          UPDATE policies
          SET customer_name = $1, policy_number = $2, start_date = $3, coverage = $4,
              premium = $5, summary = $6
          WHERE id = $7
        `, [
          fields.customerName, fields.policyNumber, fields.startDateCiphertext,
          fields.coverage, fields.premium, fields.summary, row.id
        ]);
        counts.policies += 1;
      }
      for (const row of (await client.query('SELECT * FROM events')).rows) {
        const fields = protectEventFields(dataProtection, row.organization_id, row);
        await client.query(`
          UPDATE events SET title = $1, detail = $2, note = $3 WHERE id = $4
        `, [fields.title, fields.detail, fields.note, row.id]);
        counts.events += 1;
      }
      for (const row of (await client.query('SELECT * FROM attachments')).rows) {
        const context = {
          organizationId: row.organization_id,
          entityType: 'attachment',
          entityId: row.id,
          field: 'originalName'
        };
        const originalName = dataProtection.isProtectedText(row.original_name)
          ? dataProtection.needsRotation(row.original_name)
            ? dataProtection.protectText(
              dataProtection.unprotectText(row.original_name, context),
              context
            )
            : row.original_name
          : dataProtection.protectText(row.original_name, context);
        await client.query(
          'UPDATE attachments SET original_name = $1 WHERE id = $2',
          [originalName, row.id]
        );
        counts.attachments += 1;
      }
      const workflowColumns = [
        ['customer_profiles', 'customer_profile', [
          ['occupation_ciphertext', 'occupation'],
          ['household_summary_ciphertext', 'householdSummary'],
          ['risk_notes_ciphertext', 'riskNotes']
        ]],
        ['customer_contacts', 'customer_contact', [['value_ciphertext', 'value']]],
        ['customer_relationships', 'customer_relationship', [
          ['display_name_ciphertext', 'displayName'],
          ['note_ciphertext', 'note']
        ]],
        ['policy_coverages', 'policy_coverage', [
          ['insured_amount_ciphertext', 'insuredAmount'],
          ['benefit_summary_ciphertext', 'benefitSummary']
        ]],
        ['policy_parties', 'policy_party', [['display_name_ciphertext', 'displayName']]],
        ['customer_interactions', 'customer_interaction', [
          ['subject_ciphertext', 'subject'],
          ['summary_ciphertext', 'summary']
        ]],
        ['tasks', 'task', [
          ['title_ciphertext', 'title'],
          ['detail_ciphertext', 'detail']
        ]],
        ['documents', 'document', [
          ['title_ciphertext', 'title'],
          ['extracted_data_ciphertext', 'extractedData']
        ]],
        ['consents', 'consent', [['note_ciphertext', 'note']]],
        ['search_tokens', 'search_entry', [['display_ciphertext', 'display']]],
        ['import_jobs', 'import_job', [
          ['file_name_ciphertext', 'fileName'],
          ['rows_ciphertext', 'rows'],
          ['error_csv_ciphertext', 'errors']
        ]],
        ['ocr_fields', 'ocr_field', [['value_ciphertext', 'value']]],
        ['ocr_corrections', 'ocr_correction', [
          ['previous_value_ciphertext', 'previousValue'],
          ['corrected_value_ciphertext', 'correctedValue']
        ]]
      ];
      for (const [table, entityType, columns] of workflowColumns) {
        const rows = (await client.query(`SELECT ctid::text AS _ctid, * FROM ${table}`)).rows;
        for (const row of rows) {
          const values = [];
          const assignments = [];
          for (const [column, field] of columns) {
            const context = {
              organizationId: row.organization_id,
              entityType,
              entityId: row.entity_id || row.id,
              field
            };
            const current = row[column];
            const protectedValue = dataProtection.isProtectedText(current)
              ? dataProtection.needsRotation(current)
                ? dataProtection.protectText(
                  dataProtection.unprotectText(current, context),
                  context
                )
                : current
              : dataProtection.protectText(current, context);
            values.push(protectedValue);
            assignments.push(`${column} = $${values.length}`);
            counts.workflow += 1;
          }
          values.push(row._ctid);
          await client.query(`
            UPDATE ${table}
            SET ${assignments.join(', ')}
            WHERE ctid = $${values.length}::tid
          `, values);
        }
      }
      return counts;
    });
  }

  async function verifyIntegrity() {
    const row = await one(pool, 'SELECT current_database() AS database, now() AS checked_at');
    return row ? ['ok'] : ['unavailable'];
  }

  async function phase2MigrationReport() {
    const requiredTables = [
      'customer_profiles',
      'customer_contacts',
      'customer_relationships',
      'policy_coverages',
      'policy_parties',
      'customer_interactions',
      'tasks',
      'documents',
      'consents'
    ];
    const tableResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [requiredTables]);
    const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
    const counts = {};
    for (const table of ['customers', 'policies', 'events']) {
      const row = await one(pool, `
        SELECT
          count(*)::bigint AS total,
          count(*) FILTER (WHERE archived_at IS NULL)::bigint AS active,
          count(*) FILTER (WHERE archived_at IS NOT NULL)::bigint AS archived
        FROM ${table}
      `);
      counts[table] = Object.fromEntries(
        Object.entries(row).map(([name, value]) => [name, Number(value)])
      );
    }
    const scopeQueries = {
      customerContacts: `
        SELECT count(*)::bigint AS count FROM customer_contacts AS item
        LEFT JOIN customers AS parent
          ON parent.id = item.customer_id AND parent.organization_id = item.organization_id
        WHERE parent.id IS NULL
      `,
      customerProfiles: `
        SELECT count(*)::bigint AS count FROM customer_profiles AS item
        LEFT JOIN customers AS parent
          ON parent.id = item.customer_id AND parent.organization_id = item.organization_id
        WHERE parent.id IS NULL
      `,
      customerRelationships: `
        SELECT count(*)::bigint AS count FROM customer_relationships AS item
        LEFT JOIN customers AS parent
          ON parent.id = item.customer_id AND parent.organization_id = item.organization_id
        WHERE parent.id IS NULL
      `,
      policyCoverages: `
        SELECT count(*)::bigint AS count FROM policy_coverages AS item
        LEFT JOIN policies AS parent
          ON parent.id = item.policy_id AND parent.organization_id = item.organization_id
        WHERE parent.id IS NULL
      `,
      policyParties: `
        SELECT count(*)::bigint AS count FROM policy_parties AS item
        LEFT JOIN policies AS parent
          ON parent.id = item.policy_id AND parent.organization_id = item.organization_id
        WHERE parent.id IS NULL
      `
    };
    const scopeViolations = {};
    for (const [name, sql] of Object.entries(scopeQueries)) {
      scopeViolations[name] = Number((await one(pool, sql)).count);
    }
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));
    return {
      counts,
      engine: 'postgresql',
      missingTables,
      schemaReady: missingTables.length === 0,
      scopeViolations
    };
  }

  async function dataProtectionStatus() {
    const queries = [
      'SELECT name, phone, email, birthday, needs, note FROM customers',
      `SELECT customer_name, policy_number, start_date, coverage, premium, summary
       FROM policies`,
      'SELECT title, detail, note FROM events',
      'SELECT original_name FROM attachments',
      `SELECT occupation_ciphertext, household_summary_ciphertext, risk_notes_ciphertext
       FROM customer_profiles`,
      'SELECT value_ciphertext FROM customer_contacts',
      'SELECT display_name_ciphertext, note_ciphertext FROM customer_relationships',
      'SELECT insured_amount_ciphertext, benefit_summary_ciphertext FROM policy_coverages',
      'SELECT display_name_ciphertext FROM policy_parties',
      'SELECT subject_ciphertext, summary_ciphertext FROM customer_interactions',
      'SELECT title_ciphertext, detail_ciphertext FROM tasks',
      'SELECT title_ciphertext, extracted_data_ciphertext FROM documents',
      'SELECT note_ciphertext FROM consents',
      'SELECT display_ciphertext FROM search_tokens',
      'SELECT file_name_ciphertext, rows_ciphertext, error_csv_ciphertext FROM import_jobs',
      'SELECT value_ciphertext FROM ocr_fields',
      `SELECT previous_value_ciphertext, corrected_value_ciphertext
       FROM ocr_corrections`
    ];
    const values = [];
    for (const sql of queries) {
      const rows = (await pool.query(sql)).rows;
      for (const row of rows) values.push(...Object.values(row));
    }
    const result = {
      currentKeyId: dataProtection?.currentKeyId || null,
      plaintextValues: 0,
      protectedValues: 0,
      byKeyId: {}
    };
    for (const value of values) {
      const keyId = dataProtection?.getProtectedTextKeyId(value);
      if (!keyId) {
        result.plaintextValues += 1;
        continue;
      }
      result.protectedValues += 1;
      result.byKeyId[keyId] = (result.byKeyId[keyId] || 0) + 1;
    }
    return result;
  }

  async function migrationCounts(executor = pool) {
    const mappings = {
      organizations: 'organizations',
      users: 'users',
      recoveryCodes: 'user_recovery_codes',
      customers: 'customers',
      policies: 'policies',
      events: 'events',
      teamMembers: 'team_members',
      teamTasks: 'team_tasks',
      organizationSettings: 'organization_settings',
      organizationRevisions: 'organization_revisions',
      auditLogs: 'audit_logs',
      attachments: 'attachments'
    };
    const result = {};
    for (const [name, table] of Object.entries(mappings)) {
      const row = await one(executor, `SELECT count(*)::bigint AS count FROM ${table}`);
      result[name] = Number(row.count);
    }
    return result;
  }

  async function importPostgresqlSnapshot(snapshot) {
    if (snapshot?.format !== 'sasha-postgresql-migration-v1') {
      throw new Error('INVALID_POSTGRESQL_MIGRATION_SNAPSHOT');
    }
    const requiredCollections = [
      'organizations',
      'users',
      'recoveryCodes',
      'customers',
      'policies',
      'events',
      'teamMembers',
      'teamTasks',
      'organizationSettings',
      'organizationRevisions',
      'auditLogs',
      'attachments'
    ];
    if (requiredCollections.some((name) => !Array.isArray(snapshot[name]))) {
      throw new Error('INVALID_POSTGRESQL_MIGRATION_SNAPSHOT');
    }

    return transaction(pool, async (client) => {
      await client.query(`
        LOCK TABLE
          organizations, users, user_recovery_codes, customers, policies, events,
          team_members, team_tasks, organization_settings, organization_revisions,
          audit_logs, attachments
        IN SHARE ROW EXCLUSIVE MODE
      `);
      const before = await migrationCounts(client);
      if (Object.values(before).some((count) => count > 0)) {
        throw new Error('POSTGRESQL_TARGET_NOT_EMPTY');
      }

      for (const row of snapshot.organizations) {
        await client.query(`
          INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)
        `, [row.id, row.name, row.created_at]);
      }
      for (const row of snapshot.users) {
        await client.query(`
          INSERT INTO users (
            id, organization_id, display_name, username, password_hash, password_salt,
            role, active, failed_login_attempts, locked_until, last_login_at,
            mfa_secret_ciphertext, mfa_enabled, mfa_last_counter, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
        `, [
          row.id, row.organization_id, row.display_name, row.username,
          row.password_hash, row.password_salt, row.role, Boolean(row.active),
          Number(row.failed_login_attempts || 0), row.locked_until, row.last_login_at,
          row.mfa_secret_ciphertext, Boolean(row.mfa_enabled), row.mfa_last_counter,
          row.created_at, row.updated_at
        ]);
      }
      for (const row of snapshot.recoveryCodes) {
        await client.query(`
          INSERT INTO user_recovery_codes (
            id, user_id, code_hash, created_at, used_at
          ) VALUES ($1, $2, $3, $4, $5)
        `, [row.id, row.user_id, row.code_hash, row.created_at, row.used_at]);
      }
      for (const row of snapshot.customers) {
        const protectedFields = protectCustomerFields(dataProtection, row.organization_id, {
          ...row,
          birthday: row.birthday
        });
        await client.query(`
          INSERT INTO customers (
            id, organization_id, name, phone, email, birthday, owner_user_id, owner, stage,
            next_follow_up, needs, note, version, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )
        `, [
          row.id, row.organization_id, protectedFields.name, protectedFields.phone,
          protectedFields.email, protectedFields.birthdayCiphertext,
          nullableText(row.owner_user_id), row.owner, row.stage,
          nullableText(row.next_follow_up), protectedFields.needs, protectedFields.note,
          Number(row.version),
          row.created_at, row.updated_at
        ]);
      }
      for (const row of snapshot.policies) {
        const protectedFields = protectPolicyFields(dataProtection, row.organization_id, {
          ...row,
          customerName: row.customer_name,
          policyNumber: row.policy_number,
          startDate: row.start_date
        });
        await client.query(`
          INSERT INTO policies (
            id, organization_id, customer_id, customer_name, company, policy_number,
            type, start_date, payment_years, coverage, premium, summary, updated_label,
            version, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          )
        `, [
          row.id, row.organization_id, row.customer_id, protectedFields.customerName, row.company,
          protectedFields.policyNumber, row.type, protectedFields.startDateCiphertext,
          row.payment_years, protectedFields.coverage, protectedFields.premium,
          protectedFields.summary, row.updated_label, Number(row.version),
          row.created_at, row.updated_at
        ]);
      }
      for (const row of snapshot.events) {
        const protectedFields = protectEventFields(dataProtection, row.organization_id, row);
        await client.query(`
          INSERT INTO events (
            id, organization_id, customer_id, title, event_date, event_time, category,
            reminder, detail, note, status, version, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
        `, [
          row.id, row.organization_id, row.customer_id, protectedFields.title, row.event_date,
          row.event_time, row.category, row.reminder, protectedFields.detail,
          protectedFields.note, row.status,
          Number(row.version), row.created_at, row.updated_at
        ]);
      }
      for (const row of snapshot.teamMembers) {
        await client.query(`
          INSERT INTO team_members (
            id, organization_id, name, role, specialty, target, closed, is_owner
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          row.id, row.organization_id, row.name, row.role, row.specialty,
          Number(row.target), Number(row.closed), Boolean(row.is_owner)
        ]);
      }
      for (const row of snapshot.teamTasks) {
        await client.query(`
          INSERT INTO team_tasks (id, organization_id, title, owner, due, done)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          row.id, row.organization_id, row.title, row.owner, row.due, Boolean(row.done)
        ]);
      }
      for (const row of snapshot.organizationSettings) {
        await client.query(`
          INSERT INTO organization_settings (organization_id, key, value)
          VALUES ($1, $2, $3)
        `, [row.organization_id, row.key, row.value]);
      }
      for (const row of snapshot.organizationRevisions) {
        await client.query(`
          INSERT INTO organization_revisions (organization_id, revision)
          VALUES ($1, $2)
        `, [row.organization_id, Number(row.revision)]);
      }
      for (const row of snapshot.attachments) {
        const encryptionContext = {
          organizationId: row.organization_id,
          entityType: 'attachment',
          entityId: row.id,
          field: 'originalName'
        };
        let originalName = row.original_name;
        if (dataProtection) {
          if (dataProtection.isProtectedText(originalName)) {
            if (dataProtection.needsRotation(originalName)) {
              originalName = dataProtection.protectText(
                dataProtection.unprotectText(originalName, encryptionContext),
                encryptionContext
              );
            }
          } else {
            originalName = dataProtection.protectText(originalName, encryptionContext);
          }
        }
        await client.query(`
          INSERT INTO attachments (
            id, organization_id, uploaded_by, customer_id, policy_id, original_name,
            media_type, size_bytes, sha256, status, storage_key, scan_detail, scanned_at,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
        `, [
          row.id, row.organization_id, row.uploaded_by, row.customer_id, row.policy_id,
          originalName, row.media_type, Number(row.size_bytes), row.sha256, row.status,
          row.storage_key, row.scan_detail, row.scanned_at, row.created_at
        ]);
      }
      for (const row of snapshot.auditLogs) {
        const metadata = typeof row.metadata === 'string'
          ? row.metadata
          : JSON.stringify(row.metadata || {});
        await client.query(`
          INSERT INTO audit_logs (
            id, organization_id, actor_user_id, action, entity_type, entity_id,
            metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        `, [
          row.id, row.organization_id, row.actor_user_id, row.action, row.entity_type,
          row.entity_id, metadata, row.created_at
        ]);
      }
      await client.query(`
        UPDATE app_meta SET value = $1 WHERE key = 'revision'
      `, [String(Number(snapshot.appRevision || 0))]);
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('user_recovery_codes', 'id'),
          GREATEST(COALESCE((SELECT max(id) FROM user_recovery_codes), 1), 1),
          EXISTS (SELECT 1 FROM user_recovery_codes)
        )
      `);
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('audit_logs', 'id'),
          GREATEST(COALESCE((SELECT max(id) FROM audit_logs), 1), 1),
          EXISTS (SELECT 1 FROM audit_logs)
        )
      `);

      const after = await migrationCounts(client);
      for (const name of requiredCollections) {
        if (after[name] !== snapshot[name].length) {
          throw new Error(`POSTGRESQL_MIGRATION_COUNT_MISMATCH:${name}`);
        }
      }
      return {
        counts: after,
        sessionsMigrated: false
      };
    });
  }

  const workflowRepository = createWorkflowRepository({
    engine: 'postgresql',
    driver: pool,
    dataProtection,
    mutate: runOrganizationMutation,
    audit: recordAudit,
    getCustomer: (
      organizationId,
      id,
      accessUserId,
      executor = pool
    ) => getOrganizationCustomerWithExecutor(
      organizationId,
      id,
      accessUserId,
      executor
    ),
    getPolicy: (
      organizationId,
      id,
      accessUserId,
      executor = pool
    ) => getOrganizationPolicyWithExecutor(
      organizationId,
      id,
      accessUserId,
      executor
    )
  });

  return {
    ...workflowRepository,
    changeOrganizationUserPassword,
    close: () => pool.end(),
    countUsers,
    createOrganization,
    createOrganizationAttachment,
    createOrganizationCustomer,
    createOrganizationEvent,
    createOrganizationOwner,
    createOrganizationPolicy,
    createOrganizationUser,
    createSession,
    consumeUserRecoveryCode,
    consumeUserTotpCounter,
    deleteExpiredSessions,
    deleteOrganizationCustomer,
    deleteOrganizationEvent,
    deleteOrganizationPolicy,
    deleteSession,
    dataProtectionStatus,
    disableOrganizationUserMfa,
    enableOrganizationUserMfa,
    engine: 'postgresql',
    getOrganizationCustomer,
    getOrganizationAttachment,
    getOrganizationEvent,
    getOrganizationPolicy,
    getOrganizationRevision,
    getOrganizationState,
    getOrganizationUser,
    getRevision,
    getSession,
    getUserById,
    getUserByUsername,
    importPostgresqlSnapshot,
    listOrganizationAuditLogs,
    listAttachmentsForMaintenance,
    listOrganizationAttachments,
    listOrganizationCustomers,
    listOrganizationEvents,
    listOrganizationPolicies,
    listOrganizationResourcePage,
    listOrganizationUsers,
    migrationCounts,
    phase2MigrationReport,
    protectSensitiveData,
    recordOrganizationApiAudit,
    recordLoginFailure,
    recordLoginSuccess,
    recoverOrganizationUser,
    replaceOrganizationState,
    replaceOrganizationTeamState,
    resetOrganizationUserPassword,
    setOrganizationUserMfaPending,
    setOrganizationResourceArchived,
    touchSession,
    updateOrganizationCustomer,
    updateOrganizationEvent,
    updateOrganizationPolicy,
    updateOrganizationUser,
    verifyIntegrity
  };
}

export async function connectPostgresqlDatabase({
  connectionString,
  max = 10,
  ssl = false,
  poolFactory,
  dataProtection = null
}) {
  let createPool = poolFactory;
  if (!createPool) {
    let postgres;
    try {
      postgres = await import('pg');
    } catch (error) {
      throw new Error(
        'PostgreSQL requires the "pg" package. Run npm install before enabling SASHA_DATABASE_URL.',
        { cause: error }
      );
    }
    const Pool = postgres.Pool || postgres.default?.Pool;
    createPool = (config) => new Pool(config);
  }
  const pool = await createPool({
    connectionString,
    max: Math.min(Math.max(Number(max) || 10, 1), 50),
    ssl
  });
  pool.on?.('error', (error) => {
    console.error('Unexpected PostgreSQL connection pool error.', error);
  });
  await pool.query('SELECT 1');
  await runPostgresqlMigrations(pool);
  const database = createPostgresqlDatabase(pool, { dataProtection });
  await database.protectSensitiveData();
  return database;
}
