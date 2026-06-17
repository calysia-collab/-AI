import { randomUUID } from 'node:crypto';

import {
  unprotectCustomerFields,
  unprotectPolicyFields
} from './protected-records.mjs';

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function nullable(value) {
  const result = text(value).trim();
  return result || null;
}

function timestamp(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function encryptionContext(organizationId, entityType, entityId, field) {
  return {
    organizationId: text(organizationId),
    entityType,
    entityId: text(entityId),
    field
  };
}

function protect(dataProtection, organizationId, entityType, entityId, field, value) {
  const normalized = text(value);
  if (!dataProtection) return normalized;
  const context = encryptionContext(organizationId, entityType, entityId, field);
  if (dataProtection.isProtectedText(normalized)) {
    if (!dataProtection.needsRotation(normalized)) return normalized;
    return dataProtection.protectText(
      dataProtection.unprotectText(normalized, context),
      context
    );
  }
  return dataProtection.protectText(normalized, context);
}

function unprotect(dataProtection, organizationId, entityType, entityId, field, value) {
  if (!dataProtection) return text(value);
  return dataProtection.unprotectText(
    value,
    encryptionContext(organizationId, entityType, entityId, field)
  );
}

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createExecutor(engine, driver) {
  const sql = (value) => engine === 'postgresql' ? postgresSql(value) : value;
  const parameters = (values) => engine === 'sqlite'
    ? values.map((value) => typeof value === 'boolean' ? Number(value) : value)
    : values;
  return {
    async all(executor, statement, values = []) {
      if (engine === 'postgresql') {
        return (await executor.query(sql(statement), values)).rows;
      }
      return executor.prepare(statement).all(...parameters(values));
    },
    async get(executor, statement, values = []) {
      if (engine === 'postgresql') {
        return (await executor.query(sql(statement), values)).rows[0] || null;
      }
      return executor.prepare(statement).get(...parameters(values)) || null;
    },
    async run(executor, statement, values = []) {
      if (engine === 'postgresql') {
        const result = await executor.query(sql(statement), values);
        return {
          changes: result.rowCount,
          rows: result.rows
        };
      }
      const result = executor.prepare(statement).run(...parameters(values));
      return {
        changes: Number(result.changes || 0),
        rows: []
      };
    },
    driver
  };
}

const customerResources = {
  contacts: {
    table: 'customer_contacts',
    entityType: 'customer_contact',
    fields: {
      contactType: ['contact_type', 'plain'],
      label: ['label', 'plain'],
      value: ['value_ciphertext', 'encrypted'],
      isPrimary: ['is_primary', 'boolean']
    }
  },
  relationships: {
    table: 'customer_relationships',
    entityType: 'customer_relationship',
    fields: {
      relatedCustomerId: ['related_customer_id', 'nullable'],
      relationshipType: ['relationship_type', 'plain'],
      displayName: ['display_name_ciphertext', 'encrypted'],
      note: ['note_ciphertext', 'encrypted']
    }
  },
  interactions: {
    table: 'customer_interactions',
    entityType: 'customer_interaction',
    fields: {
      advisorUserId: ['advisor_user_id', 'nullable'],
      interactionType: ['interaction_type', 'plain'],
      occurredAt: ['occurred_at', 'nullable'],
      subject: ['subject_ciphertext', 'encrypted'],
      summary: ['summary_ciphertext', 'encrypted']
    }
  },
  tasks: {
    table: 'tasks',
    entityType: 'task',
    fields: {
      assignedUserId: ['assigned_user_id', 'nullable'],
      title: ['title_ciphertext', 'encrypted'],
      detail: ['detail_ciphertext', 'encrypted'],
      dueAt: ['due_at', 'nullable'],
      status: ['status', 'plain'],
      priority: ['priority', 'plain']
    }
  },
  documents: {
    table: 'documents',
    entityType: 'document',
    fields: {
      policyId: ['policy_id', 'nullable'],
      attachmentId: ['attachment_id', 'nullable'],
      documentType: ['document_type', 'plain'],
      title: ['title_ciphertext', 'encrypted'],
      extractedData: ['extracted_data_ciphertext', 'encrypted'],
      processingStatus: ['processing_status', 'plain']
    }
  },
  consents: {
    table: 'consents',
    entityType: 'consent',
    fields: {
      consentType: ['consent_type', 'plain'],
      status: ['status', 'plain'],
      grantedAt: ['granted_at', 'nullable'],
      withdrawnAt: ['withdrawn_at', 'nullable'],
      expiresAt: ['expires_at', 'nullable'],
      evidenceDocumentId: ['evidence_document_id', 'nullable'],
      note: ['note_ciphertext', 'encrypted']
    }
  }
};

const policyResources = {
  coverages: {
    table: 'policy_coverages',
    entityType: 'policy_coverage',
    fields: {
      coverageType: ['coverage_type', 'plain'],
      insuredAmount: ['insured_amount_ciphertext', 'encrypted'],
      benefitSummary: ['benefit_summary_ciphertext', 'encrypted'],
      waitingPeriod: ['waiting_period', 'plain']
    }
  },
  parties: {
    table: 'policy_parties',
    entityType: 'policy_party',
    fields: {
      customerId: ['customer_id', 'nullable'],
      partyType: ['party_type', 'plain'],
      displayName: ['display_name_ciphertext', 'encrypted'],
      relationshipLabel: ['relationship_label', 'plain']
    }
  }
};

function encodeField(
  dataProtection,
  organizationId,
  configuration,
  entityId,
  property,
  type,
  value
) {
  if (type === 'encrypted') {
    return protect(
      dataProtection,
      organizationId,
      configuration.entityType,
      entityId,
      property,
      value
    );
  }
  if (type === 'boolean') return Boolean(value);
  if (type === 'nullable') return nullable(value);
  return text(value);
}

function mapRecord(dataProtection, configuration, row) {
  if (!row) return null;
  const item = {
    id: row.id,
    version: Number(row.version),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at)
  };
  for (const [property, [column, type]] of Object.entries(configuration.fields)) {
    const value = row[column];
    if (type === 'encrypted') {
      item[property] = unprotect(
        dataProtection,
        row.organization_id,
        configuration.entityType,
        row.id,
        property,
        value
      );
    } else if (type === 'boolean') {
      item[property] = Boolean(value);
    } else {
      item[property] = timestamp(value);
    }
  }
  return item;
}

function normalizedSearchTerms(value) {
  const normalized = text(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.+-]+/gu, ' ')
    .trim();
  if (!normalized) return [];
  const terms = new Set([normalized]);
  for (const part of normalized.split(/\s+/)) {
    if (!part) continue;
    terms.add(part);
    if (/[\p{Script=Han}]/u.test(part) && part.length > 1) {
      for (let index = 0; index < part.length - 1; index += 1) {
        terms.add(part.slice(index, index + 2));
      }
    }
  }
  return [...terms].filter((term) => term.length <= 100).slice(0, 80);
}

function searchTokens(dataProtection, organizationId, values) {
  const terms = new Set(values.flatMap(normalizedSearchTerms));
  return [...terms].map((term) => dataProtection
    ? dataProtection.blindIndex(term, {
        organizationId,
        entityType: 'search',
        entityId: '',
        field: 'token'
      })
    : term);
}

function importJob(row, dataProtection) {
  if (!row) return null;
  const organizationId = row.organization_id;
  const entityId = row.id;
  return {
    id: entityId,
    fileName: unprotect(
      dataProtection,
      organizationId,
      'import_job',
      entityId,
      'fileName',
      row.file_name_ciphertext
    ),
    format: row.format,
    status: row.status,
    total: Number(row.total_rows || 0),
    processed: Number(row.processed_rows || 0),
    imported: Number(row.imported_rows || 0),
    failed: Number(row.failed_rows || 0),
    cancelRequested: Boolean(row.cancel_requested),
    createdAt: timestamp(row.created_at),
    startedAt: timestamp(row.started_at),
    completedAt: timestamp(row.completed_at)
  };
}

function ocrField(row, dataProtection) {
  return {
    id: row.id,
    name: row.field_name,
    label: row.field_label,
    value: unprotect(
      dataProtection,
      row.organization_id,
      'ocr_field',
      row.id,
      'value',
      row.value_ciphertext
    ),
    confidence: Number(row.confidence || 0),
    corrected: Boolean(row.corrected),
    version: Number(row.version)
  };
}

function ocrJob(row, fields = []) {
  if (!row) return null;
  return {
    id: row.id,
    attachmentId: row.attachment_id,
    customerId: row.customer_id,
    documentId: row.document_id,
    policyId: row.policy_id,
    provider: row.provider,
    status: row.status,
    errorCode: row.error_code || '',
    version: Number(row.version),
    fields,
    createdAt: timestamp(row.created_at),
    startedAt: timestamp(row.started_at),
    completedAt: timestamp(row.completed_at),
    reviewedAt: timestamp(row.reviewed_at),
    reviewedBy: row.reviewed_by || null
  };
}

export function ensureSqliteWorkflowSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS search_tokens (
      organization_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      customer_id TEXT,
      display_ciphertext TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (organization_id, entity_type, entity_id, token_hash)
    );
    CREATE INDEX IF NOT EXISTS search_tokens_lookup_idx
      ON search_tokens(organization_id, token_hash, entity_type);

    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      file_name_ciphertext TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      processed_rows INTEGER NOT NULL DEFAULT 0,
      imported_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      rows_ciphertext TEXT NOT NULL,
      error_csv_ciphertext TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS import_jobs_organization_idx
      ON import_jobs(organization_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ocr_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      attachment_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      document_id TEXT,
      policy_id TEXT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE RESTRICT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS ocr_jobs_organization_idx
      ON ocr_jobs(organization_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ocr_fields (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      ocr_job_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_label TEXT NOT NULL,
      value_ciphertext TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      corrected INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      UNIQUE (ocr_job_id, field_name),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (ocr_job_id) REFERENCES ocr_jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ocr_corrections (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      ocr_job_id TEXT NOT NULL,
      ocr_field_id TEXT NOT NULL,
      corrected_by TEXT NOT NULL,
      previous_value_ciphertext TEXT NOT NULL,
      corrected_value_ciphertext TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (ocr_job_id) REFERENCES ocr_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (ocr_field_id) REFERENCES ocr_fields(id) ON DELETE CASCADE,
      FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE RESTRICT
    );
  `);
}

export function createWorkflowRepository({
  engine,
  driver,
  dataProtection,
  mutate,
  audit,
  getCustomer,
  getPolicy
}) {
  const db = createExecutor(engine, driver);

  async function requireParent(
    parentType,
    organizationId,
    parentId,
    accessUserId,
    executor = driver
  ) {
    const item = parentType === 'customer'
      ? await getCustomer(organizationId, parentId, accessUserId, executor)
      : await getPolicy(organizationId, parentId, accessUserId, executor);
    if (item) return item;
    throw new Error(parentType === 'customer'
      ? 'CUSTOMER_ACCESS_DENIED'
      : 'POLICY_NOT_IN_ORGANIZATION');
  }

  async function listRecords(
    configuration,
    parentColumn,
    organizationId,
    parentId,
    accessUserId
  ) {
    await requireParent(
      parentColumn === 'customer_id' ? 'customer' : 'policy',
      organizationId,
      parentId,
      accessUserId
    );
    const rows = await db.all(driver, `
      SELECT * FROM ${configuration.table}
      WHERE organization_id = ? AND ${parentColumn} = ? AND archived_at IS NULL
      ORDER BY updated_at DESC, id
    `, [text(organizationId), text(parentId)]);
    return rows.map((row) => mapRecord(dataProtection, configuration, row));
  }

  async function getRecord(
    configuration,
    parentColumn,
    organizationId,
    parentId,
    recordId,
    accessUserId,
    executor = driver
  ) {
    await requireParent(
      parentColumn === 'customer_id' ? 'customer' : 'policy',
      organizationId,
      parentId,
      accessUserId,
      executor
    );
    return mapRecord(dataProtection, configuration, await db.get(executor, `
      SELECT * FROM ${configuration.table}
      WHERE organization_id = ? AND ${parentColumn} = ? AND id = ? AND archived_at IS NULL
    `, [text(organizationId), text(parentId), text(recordId)]));
  }

  async function createRecord(
    configuration,
    parentColumn,
    organizationId,
    actorUserId,
    parentId,
    item,
    accessUserId
  ) {
    return mutate(organizationId, async (executor) => {
      await requireParent(
        parentColumn === 'customer_id' ? 'customer' : 'policy',
        organizationId,
        parentId,
        accessUserId,
        executor
      );
      const id = text(item.id || `${configuration.entityType}-${randomUUID()}`);
      const now = new Date().toISOString();
      const columns = ['id', 'organization_id', parentColumn];
      const values = [id, text(organizationId), text(parentId)];
      for (const [property, [column, type]] of Object.entries(configuration.fields)) {
        columns.push(column);
        values.push(encodeField(
          dataProtection,
          organizationId,
          configuration,
          id,
          property,
          type,
          item[property]
        ));
      }
      columns.push('version', 'created_at', 'updated_at');
      values.push(1, now, now);
      await db.run(executor, `
        INSERT INTO ${configuration.table} (${columns.join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
      `, values);
      await audit(
        executor,
        organizationId,
        actorUserId,
        'create',
        configuration.entityType,
        id,
        { parentId: text(parentId), version: 1 }
      );
      return {
        item: await getRecord(
          configuration,
          parentColumn,
          organizationId,
          parentId,
          id,
          accessUserId,
          executor
        )
      };
    });
  }

  async function updateRecord(
    configuration,
    parentColumn,
    organizationId,
    actorUserId,
    parentId,
    recordId,
    item,
    expectedVersion,
    accessUserId
  ) {
    return mutate(organizationId, async (executor) => {
      const current = await getRecord(
        configuration,
        parentColumn,
        organizationId,
        parentId,
        recordId,
        accessUserId,
        executor
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) {
        return { conflict: true, item: current };
      }
      const assignments = [];
      const values = [];
      for (const [property, [column, type]] of Object.entries(configuration.fields)) {
        assignments.push(`${column} = ?`);
        values.push(encodeField(
          dataProtection,
          organizationId,
          configuration,
          recordId,
          property,
          type,
          item[property]
        ));
      }
      assignments.push('version = version + 1', 'updated_at = ?');
      values.push(new Date().toISOString());
      values.push(
        text(organizationId),
        text(parentId),
        text(recordId),
        Number(expectedVersion)
      );
      const result = await db.run(executor, `
        UPDATE ${configuration.table}
        SET ${assignments.join(', ')}
        WHERE organization_id = ? AND ${parentColumn} = ? AND id = ? AND version = ?
      `, values);
      if (!result.changes) {
        return {
          conflict: true,
          item: await getRecord(
            configuration,
            parentColumn,
            organizationId,
            parentId,
            recordId,
            accessUserId,
            executor
          )
        };
      }
      await audit(
        executor,
        organizationId,
        actorUserId,
        'update',
        configuration.entityType,
        recordId,
        {
          fromVersion: Number(expectedVersion),
          toVersion: Number(expectedVersion) + 1
        }
      );
      return {
        item: await getRecord(
          configuration,
          parentColumn,
          organizationId,
          parentId,
          recordId,
          accessUserId,
          executor
        )
      };
    });
  }

  async function archiveRecord(
    configuration,
    parentColumn,
    organizationId,
    actorUserId,
    parentId,
    recordId,
    expectedVersion,
    accessUserId
  ) {
    return mutate(organizationId, async (executor) => {
      const current = await getRecord(
        configuration,
        parentColumn,
        organizationId,
        parentId,
        recordId,
        accessUserId,
        executor
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) {
        return { conflict: true, item: current };
      }
      const result = await db.run(executor, `
        UPDATE ${configuration.table}
        SET archived_at = ?, version = version + 1, updated_at = ?
        WHERE organization_id = ? AND ${parentColumn} = ? AND id = ? AND version = ?
      `, [
        new Date().toISOString(),
        new Date().toISOString(),
        text(organizationId),
        text(parentId),
        text(recordId),
        Number(expectedVersion)
      ]);
      if (!result.changes) return { conflict: true, item: current };
      await audit(
        executor,
        organizationId,
        actorUserId,
        'archive',
        configuration.entityType,
        recordId,
        { version: Number(expectedVersion) }
      );
      return { deletedId: text(recordId) };
    });
  }

  async function getCustomerWorkspace(organizationId, customerId, accessUserId = null) {
    const customer = await requireParent(
      'customer',
      organizationId,
      customerId,
      accessUserId
    );
    const [policies, ...collections] = await Promise.all([
      db.all(driver, `
        SELECT * FROM policies
        WHERE organization_id = ? AND customer_id = ? AND archived_at IS NULL
        ORDER BY updated_at DESC
      `, [text(organizationId), text(customerId)]),
      ...Object.values(customerResources).map((configuration) =>
        listRecords(
          configuration,
          'customer_id',
          organizationId,
          customerId,
          accessUserId
        ))
    ]);
    const result = {
      customer,
      policies: policies.map((row) => ({
        id: row.id,
        company: row.company,
        type: row.type,
        version: Number(row.version),
        ...unprotectPolicyFields(dataProtection, row)
      }))
    };
    Object.keys(customerResources).forEach((name, index) => {
      result[name] = collections[index];
    });
    return result;
  }

  async function listCustomerWorkspaceRecords(
    resourceName,
    organizationId,
    customerId,
    accessUserId = null
  ) {
    const configuration = customerResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_WORKSPACE_RESOURCE');
    return listRecords(
      configuration,
      'customer_id',
      organizationId,
      customerId,
      accessUserId
    );
  }

  async function createCustomerWorkspaceRecord(
    resourceName,
    organizationId,
    actorUserId,
    customerId,
    item,
    accessUserId = null
  ) {
    const configuration = customerResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_WORKSPACE_RESOURCE');
    return createRecord(
      configuration,
      'customer_id',
      organizationId,
      actorUserId,
      customerId,
      item,
      accessUserId
    );
  }

  async function updateCustomerWorkspaceRecord(
    resourceName,
    organizationId,
    actorUserId,
    customerId,
    recordId,
    item,
    expectedVersion,
    accessUserId = null
  ) {
    const configuration = customerResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_WORKSPACE_RESOURCE');
    return updateRecord(
      configuration,
      'customer_id',
      organizationId,
      actorUserId,
      customerId,
      recordId,
      item,
      expectedVersion,
      accessUserId
    );
  }

  async function archiveCustomerWorkspaceRecord(
    resourceName,
    organizationId,
    actorUserId,
    customerId,
    recordId,
    expectedVersion,
    accessUserId = null
  ) {
    const configuration = customerResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_WORKSPACE_RESOURCE');
    return archiveRecord(
      configuration,
      'customer_id',
      organizationId,
      actorUserId,
      customerId,
      recordId,
      expectedVersion,
      accessUserId
    );
  }

  async function listPolicyWorkspaceRecords(
    resourceName,
    organizationId,
    policyId,
    accessUserId = null
  ) {
    const configuration = policyResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_POLICY_RESOURCE');
    return listRecords(
      configuration,
      'policy_id',
      organizationId,
      policyId,
      accessUserId
    );
  }

  async function createPolicyWorkspaceRecord(
    resourceName,
    organizationId,
    actorUserId,
    policyId,
    item,
    accessUserId = null
  ) {
    const configuration = policyResources[resourceName];
    if (!configuration) throw new Error('UNSUPPORTED_POLICY_RESOURCE');
    return createRecord(
      configuration,
      'policy_id',
      organizationId,
      actorUserId,
      policyId,
      item,
      accessUserId
    );
  }

  async function replaceSearchTokens(
    executor,
    organizationId,
    entityType,
    entityId,
    customerId,
    display,
    values
  ) {
    await db.run(executor, `
      DELETE FROM search_tokens
      WHERE organization_id = ? AND entity_type = ? AND entity_id = ?
    `, [text(organizationId), entityType, text(entityId)]);
    const encryptedDisplay = protect(
      dataProtection,
      organizationId,
      'search_entry',
      entityId,
      'display',
      display
    );
    const now = new Date().toISOString();
    for (const tokenHash of searchTokens(dataProtection, organizationId, values)) {
      await db.run(executor, `
        INSERT INTO search_tokens (
          organization_id, entity_type, entity_id, customer_id,
          display_ciphertext, token_hash, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        text(organizationId),
        entityType,
        text(entityId),
        nullable(customerId),
        encryptedDisplay,
        tokenHash,
        now
      ]);
    }
  }

  async function indexSearchEntityWithinMutation(
    executor,
    organizationId,
    entityType,
    item
  ) {
    if (entityType === 'customer') {
      await replaceSearchTokens(
        executor,
        organizationId,
        'customer',
        item.id,
        item.id,
        item.name,
        [item.name, item.phone, item.email, item.needs, item.owner]
      );
    } else if (entityType === 'policy') {
      await replaceSearchTokens(
        executor,
        organizationId,
        'policy',
        item.id,
        item.customerId,
        `${item.customer}・${item.company} ${item.type}`,
        [
          item.customer,
          item.company,
          item.policyNumber,
          item.type,
          item.coverage,
          item.summary
        ]
      );
    }
  }

  async function ensureSearchIndex(organizationId) {
    const indexed = await db.get(driver, `
      SELECT count(DISTINCT entity_type || ':' || entity_id) AS count
      FROM search_tokens WHERE organization_id = ?
    `, [text(organizationId)]);
    const expected = await db.get(driver, `
      SELECT
        (SELECT count(*) FROM customers
          WHERE organization_id = ? AND archived_at IS NULL)
        + (SELECT count(*) FROM policies
          WHERE organization_id = ? AND archived_at IS NULL) AS count
    `, [text(organizationId), text(organizationId)]);
    if (Number(indexed?.count || 0) >= Number(expected?.count || 0)) return;

    await mutate(organizationId, async (executor) => {
      const customerRows = await db.all(executor, `
        SELECT * FROM customers
        WHERE organization_id = ? AND archived_at IS NULL
      `, [text(organizationId)]);
      const policyRows = await db.all(executor, `
        SELECT * FROM policies
        WHERE organization_id = ? AND archived_at IS NULL
      `, [text(organizationId)]);
      for (const row of customerRows) {
        const fields = unprotectCustomerFields(dataProtection, row);
        await indexSearchEntityWithinMutation(executor, organizationId, 'customer', {
          id: row.id,
          owner: row.owner,
          ...fields
        });
      }
      for (const row of policyRows) {
        const fields = unprotectPolicyFields(dataProtection, row);
        await indexSearchEntityWithinMutation(executor, organizationId, 'policy', {
          id: row.id,
          customerId: row.customer_id,
          company: row.company,
          type: row.type,
          coverage: fields.coverage,
          policyNumber: fields.policyNumber,
          summary: fields.summary,
          customer: fields.customer
        });
      }
      return {};
    });
  }

  async function searchOrganization(
    organizationId,
    query,
    accessUserId = null,
    limit = 20
  ) {
    const hashes = searchTokens(dataProtection, organizationId, [query]);
    if (!hashes.length) return [];
    await ensureSearchIndex(organizationId);
    const placeholders = hashes.map(() => '?').join(', ');
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const values = [text(organizationId), ...hashes];
    let accessClause = '';
    if (accessUserId) {
      accessClause = ` AND EXISTS (
        SELECT 1 FROM customers
        WHERE customers.organization_id = search_tokens.organization_id
          AND customers.id = search_tokens.customer_id
          AND customers.owner_user_id = ?
          AND customers.archived_at IS NULL
      )`;
      values.push(text(accessUserId));
    }
    values.push(safeLimit);
    const rows = await db.all(driver, `
      SELECT
        entity_type, entity_id, customer_id, display_ciphertext,
        count(*) AS matched
      FROM search_tokens
      WHERE organization_id = ? AND token_hash IN (${placeholders})
      ${accessClause}
      GROUP BY entity_type, entity_id, customer_id, display_ciphertext
      ORDER BY matched DESC, entity_type, entity_id
      LIMIT ?
    `, values);
    return rows.map((row) => ({
      type: row.entity_type,
      id: row.entity_id,
      customerId: row.customer_id,
      display: unprotect(
        dataProtection,
        organizationId,
        'search_entry',
        row.entity_id,
        'display',
        row.display_ciphertext
      ),
      matched: Number(row.matched)
    }));
  }

  async function createImportJob(
    organizationId,
    actorUserId,
    { id = `import-${randomUUID()}`, fileName, format, rows }
  ) {
    return mutate(organizationId, async (executor) => {
      const now = new Date().toISOString();
      await db.run(executor, `
        INSERT INTO import_jobs (
          id, organization_id, uploaded_by, file_name_ciphertext, format,
          status, total_rows, rows_ciphertext, created_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)
      `, [
        id,
        text(organizationId),
        text(actorUserId),
        protect(dataProtection, organizationId, 'import_job', id, 'fileName', fileName),
        text(format),
        rows.length,
        protect(
          dataProtection,
          organizationId,
          'import_job',
          id,
          'rows',
          JSON.stringify(rows)
        ),
        now
      ]);
      await audit(executor, organizationId, actorUserId, 'create', 'import_job', id, {
        format,
        total: rows.length
      });
      return {
        item: importJob(await db.get(executor, `
          SELECT * FROM import_jobs WHERE organization_id = ? AND id = ?
        `, [text(organizationId), id]), dataProtection)
      };
    });
  }

  async function getImportJob(organizationId, id) {
    return importJob(await db.get(driver, `
      SELECT * FROM import_jobs WHERE organization_id = ? AND id = ?
    `, [text(organizationId), text(id)]), dataProtection);
  }

  async function listImportJobs(organizationId, limit = 20) {
    const rows = await db.all(driver, `
      SELECT * FROM import_jobs
      WHERE organization_id = ?
      ORDER BY created_at DESC LIMIT ?
    `, [
      text(organizationId),
      Math.min(Math.max(Number(limit) || 20, 1), 100)
    ]);
    return rows.map((row) => importJob(row, dataProtection));
  }

  async function listRecoverableImportJobs(limit = 100) {
    const rows = await db.all(driver, `
      SELECT * FROM import_jobs
      WHERE status IN ('queued', 'processing')
      ORDER BY created_at ASC LIMIT ?
    `, [Math.min(Math.max(Number(limit) || 100, 1), 500)]);
    return rows.map((row) => ({
      ...importJob(row, dataProtection),
      organizationId: row.organization_id,
      uploadedBy: row.uploaded_by
    }));
  }

  async function getImportJobPayload(organizationId, id) {
    const row = await db.get(driver, `
      SELECT rows_ciphertext, error_csv_ciphertext
      FROM import_jobs WHERE organization_id = ? AND id = ?
    `, [text(organizationId), text(id)]);
    if (!row) return null;
    const rows = unprotect(
      dataProtection,
      organizationId,
      'import_job',
      id,
      'rows',
      row.rows_ciphertext
    );
    return {
      rows: JSON.parse(rows || '[]'),
      errorCsv: unprotect(
        dataProtection,
        organizationId,
        'import_job',
        id,
        'errors',
        row.error_csv_ciphertext
      )
    };
  }

  async function updateImportJob(
    organizationId,
    id,
    {
      status,
      processed,
      imported,
      failed,
      errorCsv,
      startedAt,
      completedAt
    }
  ) {
    const values = [
      text(status),
      Number(processed || 0),
      Number(imported || 0),
      Number(failed || 0),
      errorCsv === undefined
        ? null
        : protect(dataProtection, organizationId, 'import_job', id, 'errors', errorCsv),
      nullable(startedAt),
      nullable(completedAt),
      text(organizationId),
      text(id)
    ];
    await db.run(driver, `
      UPDATE import_jobs SET
        status = ?, processed_rows = ?, imported_rows = ?, failed_rows = ?,
        error_csv_ciphertext = COALESCE(?, error_csv_ciphertext),
        started_at = COALESCE(?, started_at),
        completed_at = COALESCE(?, completed_at)
      WHERE organization_id = ? AND id = ?
    `, values);
    return getImportJob(organizationId, id);
  }

  async function requestImportJobCancellation(organizationId, id) {
    await db.run(driver, `
      UPDATE import_jobs SET cancel_requested = ?
      WHERE organization_id = ? AND id = ? AND status IN ('queued', 'processing')
    `, [true, text(organizationId), text(id)]);
    return getImportJob(organizationId, id);
  }

  async function createOcrJob(
    organizationId,
    actorUserId,
    { id = `ocr-${randomUUID()}`, attachmentId, customerId, provider }
  ) {
    return mutate(organizationId, async (executor) => {
      await requireParent('customer', organizationId, customerId, null, executor);
      const now = new Date().toISOString();
      await db.run(executor, `
        INSERT INTO ocr_jobs (
          id, organization_id, attachment_id, customer_id, provider,
          status, version, created_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', 1, ?)
      `, [
        id,
        text(organizationId),
        text(attachmentId),
        text(customerId),
        text(provider),
        now
      ]);
      await audit(executor, organizationId, actorUserId, 'create', 'ocr_job', id, {
        attachmentId,
        customerId,
        provider
      });
      return { item: await getOcrJob(organizationId, id, executor) };
    });
  }

  async function getOcrJob(organizationId, id, executor = driver) {
    const row = await db.get(executor, `
      SELECT * FROM ocr_jobs WHERE organization_id = ? AND id = ?
    `, [text(organizationId), text(id)]);
    if (!row) return null;
    const fields = await db.all(executor, `
      SELECT * FROM ocr_fields
      WHERE organization_id = ? AND ocr_job_id = ?
      ORDER BY field_name
    `, [text(organizationId), text(id)]);
    return ocrJob(row, fields.map((field) => ocrField(field, dataProtection)));
  }

  async function listOcrJobs(organizationId, customerId = null, limit = 20) {
    const values = [text(organizationId)];
    const customerClause = customerId ? ' AND customer_id = ?' : '';
    if (customerId) values.push(text(customerId));
    values.push(Math.min(Math.max(Number(limit) || 20, 1), 100));
    const rows = await db.all(driver, `
      SELECT * FROM ocr_jobs
      WHERE organization_id = ?${customerClause}
      ORDER BY created_at DESC LIMIT ?
    `, values);
    return Promise.all(rows.map((row) => getOcrJob(organizationId, row.id)));
  }

  async function listRecoverableOcrJobs(limit = 100) {
    const rows = await db.all(driver, `
      SELECT organization_id, id FROM ocr_jobs
      WHERE status IN ('queued', 'processing')
      ORDER BY created_at ASC LIMIT ?
    `, [Math.min(Math.max(Number(limit) || 100, 1), 500)]);
    return Promise.all(rows.map(async (row) => ({
      ...await getOcrJob(row.organization_id, row.id),
      organizationId: row.organization_id
    })));
  }

  async function setOcrJobResult(
    organizationId,
    id,
    { status, fields = [], errorCode = '', startedAt, completedAt }
  ) {
    return mutate(organizationId, async (executor) => {
      await db.run(executor, `
        UPDATE ocr_jobs SET
          status = ?, error_code = ?, started_at = COALESCE(?, started_at),
          completed_at = COALESCE(?, completed_at), version = version + 1
        WHERE organization_id = ? AND id = ?
      `, [
        text(status),
        text(errorCode),
        nullable(startedAt),
        nullable(completedAt),
        text(organizationId),
        text(id)
      ]);
      for (const field of fields) {
        const existingField = await db.get(executor, `
          SELECT id FROM ocr_fields
          WHERE organization_id = ? AND ocr_job_id = ? AND field_name = ?
        `, [text(organizationId), text(id), text(field.name)]);
        const fieldId = text(existingField?.id || field.id || `ocr-field-${randomUUID()}`);
        const encrypted = protect(
          dataProtection,
          organizationId,
          'ocr_field',
          fieldId,
          'value',
          field.value
        );
        if (engine === 'postgresql') {
          await db.run(executor, `
            INSERT INTO ocr_fields (
              id, organization_id, ocr_job_id, field_name, field_label,
              value_ciphertext, confidence, corrected, version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, false, 1, ?)
            ON CONFLICT (ocr_job_id, field_name) DO UPDATE SET
              field_label = EXCLUDED.field_label,
              value_ciphertext = EXCLUDED.value_ciphertext,
              confidence = EXCLUDED.confidence,
              version = ocr_fields.version + 1,
              updated_at = EXCLUDED.updated_at
          `, [
            fieldId,
            text(organizationId),
            text(id),
            text(field.name),
            text(field.label),
            encrypted,
            Number(field.confidence || 0),
            new Date().toISOString()
          ]);
        } else {
          await db.run(executor, `
            INSERT INTO ocr_fields (
              id, organization_id, ocr_job_id, field_name, field_label,
              value_ciphertext, confidence, corrected, version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
            ON CONFLICT (ocr_job_id, field_name) DO UPDATE SET
              field_label = excluded.field_label,
              value_ciphertext = excluded.value_ciphertext,
              confidence = excluded.confidence,
              version = ocr_fields.version + 1,
              updated_at = excluded.updated_at
          `, [
            fieldId,
            text(organizationId),
            text(id),
            text(field.name),
            text(field.label),
            encrypted,
            Number(field.confidence || 0),
            new Date().toISOString()
          ]);
        }
      }
      return { item: await getOcrJob(organizationId, id, executor) };
    });
  }

  async function correctOcrField(
    organizationId,
    actorUserId,
    jobId,
    fieldId,
    value,
    expectedVersion
  ) {
    return mutate(organizationId, async (executor) => {
      const row = await db.get(executor, `
        SELECT * FROM ocr_fields
        WHERE organization_id = ? AND ocr_job_id = ? AND id = ?
      `, [text(organizationId), text(jobId), text(fieldId)]);
      if (!row) return { notFound: true };
      if (Number(expectedVersion) !== Number(row.version)) {
        return {
          conflict: true,
          item: ocrField(row, dataProtection)
        };
      }
      const previousValue = unprotect(
        dataProtection,
        organizationId,
        'ocr_field',
        fieldId,
        'value',
        row.value_ciphertext
      );
      const correctedValue = protect(
        dataProtection,
        organizationId,
        'ocr_field',
        fieldId,
        'value',
        value
      );
      await db.run(executor, `
        UPDATE ocr_fields SET
          value_ciphertext = ?, corrected = ?, version = version + 1, updated_at = ?
        WHERE organization_id = ? AND ocr_job_id = ? AND id = ? AND version = ?
      `, [
        correctedValue,
        true,
        new Date().toISOString(),
        text(organizationId),
        text(jobId),
        text(fieldId),
        Number(expectedVersion)
      ]);
      const correctionId = `ocr-correction-${randomUUID()}`;
      await db.run(executor, `
        INSERT INTO ocr_corrections (
          id, organization_id, ocr_job_id, ocr_field_id, corrected_by,
          previous_value_ciphertext, corrected_value_ciphertext, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        correctionId,
        text(organizationId),
        text(jobId),
        text(fieldId),
        text(actorUserId),
        protect(
          dataProtection,
          organizationId,
          'ocr_correction',
          correctionId,
          'previousValue',
          previousValue
        ),
        protect(
          dataProtection,
          organizationId,
          'ocr_correction',
          correctionId,
          'correctedValue',
          value
        ),
        new Date().toISOString()
      ]);
      await audit(executor, organizationId, actorUserId, 'correct', 'ocr_field', fieldId, {
        jobId
      });
      return { item: await getOcrJob(organizationId, jobId, executor) };
    });
  }

  async function approveOcrJob(
    organizationId,
    actorUserId,
    jobId,
    policyId
  ) {
    return mutate(organizationId, async (executor) => {
      const result = await db.run(executor, `
        UPDATE ocr_jobs SET
          status = 'approved', policy_id = ?, reviewed_at = ?, reviewed_by = ?,
          version = version + 1
        WHERE organization_id = ? AND id = ? AND status = 'review_required'
      `, [
        text(policyId),
        new Date().toISOString(),
        text(actorUserId),
        text(organizationId),
        text(jobId)
      ]);
      if (!result.changes) {
        const current = await getOcrJob(organizationId, jobId, executor);
        return current ? { conflict: true, item: current } : { notFound: true };
      }
      await audit(executor, organizationId, actorUserId, 'approve', 'ocr_job', jobId, {
        policyId
      });
      return { item: await getOcrJob(organizationId, jobId, executor) };
    });
  }

  async function workflowMigrationReport() {
    const phase2Tables = ['search_tokens', 'import_jobs'];
    const phase3Tables = ['ocr_jobs', 'ocr_fields', 'ocr_corrections'];
    const requiredTables = [...phase2Tables, ...phase3Tables];
    const rows = engine === 'postgresql'
      ? await db.all(driver, `
          SELECT table_name AS name
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `)
      : await db.all(driver, `
          SELECT name FROM sqlite_master WHERE type = 'table'
        `);
    const existing = new Set(rows.map((row) => row.name));
    const missingPhase2Tables = phase2Tables.filter((name) => !existing.has(name));
    const missingPhase3Tables = phase3Tables.filter((name) => !existing.has(name));
    return {
      engine,
      missingPhase2Tables,
      missingPhase3Tables,
      phase2Ready: missingPhase2Tables.length === 0,
      phase3Ready: missingPhase3Tables.length === 0,
      requiredTables
    };
  }

  return {
    approveOcrJob,
    archiveCustomerWorkspaceRecord,
    correctOcrField,
    createCustomerWorkspaceRecord,
    createImportJob,
    createOcrJob,
    createPolicyWorkspaceRecord,
    getCustomerWorkspace,
    getImportJob,
    getImportJobPayload,
    getOcrJob,
    indexSearchEntityWithinMutation,
    listCustomerWorkspaceRecords,
    listImportJobs,
    listOcrJobs,
    listPolicyWorkspaceRecords,
    listRecoverableImportJobs,
    listRecoverableOcrJobs,
    requestImportJobCancellation,
    searchOrganization,
    setOcrJobResult,
    updateCustomerWorkspaceRecord,
    updateImportJob,
    workflowMigrationReport
  };
}
