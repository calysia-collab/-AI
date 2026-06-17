import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  protectCustomerFields,
  protectEventFields,
  protectPolicyFields,
  unprotectCustomerFields,
  unprotectEventFields,
  unprotectPolicyFields
} from './protected-records.mjs';
import {
  createWorkflowRepository,
  ensureSqliteWorkflowSchema
} from './workflow-repository.mjs';

function toText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function nullableText(value) {
  const text = toText(value).trim();
  return text || null;
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
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToCustomer(row, dataProtection) {
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
    nextFollowUp: row.next_follow_up,
    needs: protectedFields.needs,
    note: protectedFields.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version
  };
}

function rowToPolicy(row, dataProtection) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version
  };
}

function rowToEvent(row, dataProtection) {
  const protectedFields = unprotectEventFields(dataProtection, row);
  return {
    id: row.id,
    customerId: row.customer_id,
    title: protectedFields.title,
    date: row.event_date,
    time: row.event_time,
    category: row.category,
    reminder: row.reminder,
    detail: protectedFields.detail,
    note: protectedFields.note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version
  };
}

export function createAppDatabase(filename, { dataProtection = null } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON');
  if (filename !== ':memory:') database.exec('PRAGMA journal_mode = WAL');

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_meta (key, value) VALUES ('revision', '0');

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'advisor',
      active INTEGER NOT NULL DEFAULT 1,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_recovery_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      UNIQUE (user_id, code_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS user_recovery_codes_user_id_idx
      ON user_recovery_codes(user_id, used_at);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      birthday TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT '新名單',
      next_follow_up TEXT NOT NULL DEFAULT '',
      needs TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL,
      policy_number TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      payment_years TEXT NOT NULL DEFAULT '',
      coverage TEXT NOT NULL DEFAULT '',
      premium TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      updated_label TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS policies_customer_id_idx ON policies(customer_id);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      category TEXT NOT NULL,
      reminder TEXT NOT NULL DEFAULT '15 分鐘前',
      detail TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
    CREATE INDEX IF NOT EXISTS events_customer_id_idx ON events(customer_id);

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      specialty TEXT NOT NULL DEFAULT '',
      target INTEGER NOT NULL DEFAULT 0,
      closed INTEGER NOT NULL DEFAULT 0,
      is_owner INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS team_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      due TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS organization_revisions (
      organization_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS organization_settings (
      organization_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (organization_id, key),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      customer_id TEXT,
      policy_id TEXT,
      original_name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      scan_detail TEXT NOT NULL DEFAULT '',
      scanned_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS attachments_organization_id_idx
      ON attachments(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS attachments_customer_id_idx ON attachments(customer_id);
    CREATE INDEX IF NOT EXISTS attachments_policy_id_idx ON attachments(policy_id);
  `);

  function ensureColumn(table, column, definition) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((item) => item.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  for (const table of ['customers', 'policies', 'events', 'team_members', 'team_tasks']) {
    ensureColumn(table, 'organization_id', 'TEXT');
  }
  ensureColumn('users', 'mfa_secret_ciphertext', 'TEXT');
  ensureColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'mfa_last_counter', 'INTEGER');
  ensureColumn('customers', 'owner_user_id', 'TEXT');
  ensureColumn('customers', 'archived_at', 'TEXT');
  ensureColumn('policies', 'archived_at', 'TEXT');
  ensureColumn('events', 'archived_at', 'TEXT');
  ensureColumn('team_members', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('team_members', 'created_at', 'TEXT');
  ensureColumn('team_members', 'updated_at', 'TEXT');
  ensureColumn('team_members', 'archived_at', 'TEXT');
  ensureColumn('team_tasks', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('team_tasks', 'created_at', 'TEXT');
  ensureColumn('team_tasks', 'updated_at', 'TEXT');
  ensureColumn('team_tasks', 'archived_at', 'TEXT');
  ensureColumn('audit_logs', 'organization_id', 'TEXT');
  ensureColumn('audit_logs', 'actor_user_id', 'TEXT');
  database.exec(`
    CREATE INDEX IF NOT EXISTS customers_organization_id_idx ON customers(organization_id);
    CREATE INDEX IF NOT EXISTS customers_owner_user_id_idx
      ON customers(organization_id, owner_user_id);
    CREATE INDEX IF NOT EXISTS policies_organization_id_idx ON policies(organization_id);
    CREATE INDEX IF NOT EXISTS events_organization_id_idx ON events(organization_id);
    CREATE INDEX IF NOT EXISTS team_members_organization_id_idx ON team_members(organization_id);
    CREATE INDEX IF NOT EXISTS team_tasks_organization_id_idx ON team_tasks(organization_id);
    CREATE INDEX IF NOT EXISTS audit_logs_organization_id_idx
      ON audit_logs(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS customers_active_page_idx
      ON customers(organization_id, updated_at DESC, id)
      WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS customers_active_owner_page_idx
      ON customers(organization_id, owner_user_id, updated_at DESC, id)
      WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS policies_active_page_idx
      ON policies(organization_id, updated_at DESC, id)
      WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS events_active_page_idx
      ON events(organization_id, updated_at DESC, id)
      WHERE archived_at IS NULL;
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      occupation_ciphertext TEXT NOT NULL DEFAULT '',
      marital_status TEXT NOT NULL DEFAULT '',
      household_summary_ciphertext TEXT NOT NULL DEFAULT '',
      risk_notes_ciphertext TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      UNIQUE (organization_id, customer_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS customer_contacts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      contact_type TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      value_ciphertext TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS customer_relationships (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      related_customer_id TEXT,
      relationship_type TEXT NOT NULL,
      display_name_ciphertext TEXT NOT NULL DEFAULT '',
      note_ciphertext TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (related_customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS policy_coverages (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      coverage_type TEXT NOT NULL,
      insured_amount_ciphertext TEXT NOT NULL DEFAULT '',
      benefit_summary_ciphertext TEXT NOT NULL DEFAULT '',
      waiting_period TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS policy_parties (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      customer_id TEXT,
      party_type TEXT NOT NULL,
      display_name_ciphertext TEXT NOT NULL DEFAULT '',
      relationship_label TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS customer_interactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      advisor_user_id TEXT,
      interaction_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      subject_ciphertext TEXT NOT NULL DEFAULT '',
      summary_ciphertext TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (advisor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT,
      assigned_user_id TEXT,
      title_ciphertext TEXT NOT NULL,
      detail_ciphertext TEXT NOT NULL DEFAULT '',
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT,
      policy_id TEXT,
      attachment_id TEXT,
      document_type TEXT NOT NULL,
      title_ciphertext TEXT NOT NULL DEFAULT '',
      extracted_data_ciphertext TEXT NOT NULL DEFAULT '',
      processing_status TEXT NOT NULL DEFAULT 'pending',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      status TEXT NOT NULL,
      granted_at TEXT,
      withdrawn_at TEXT,
      expires_at TEXT,
      evidence_document_id TEXT,
      note_ciphertext TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (evidence_document_id) REFERENCES documents(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS customer_profiles_customer_idx
      ON customer_profiles(organization_id, customer_id) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS customer_contacts_customer_idx
      ON customer_contacts(organization_id, customer_id, contact_type) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS customer_relationships_customer_idx
      ON customer_relationships(organization_id, customer_id) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS policy_coverages_policy_idx
      ON policy_coverages(organization_id, policy_id) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS policy_parties_policy_idx
      ON policy_parties(organization_id, policy_id) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS customer_interactions_customer_idx
      ON customer_interactions(organization_id, customer_id, occurred_at DESC)
      WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS tasks_due_idx
      ON tasks(organization_id, status, due_at) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS documents_customer_idx
      ON documents(organization_id, customer_id, created_at DESC) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS documents_policy_idx
      ON documents(organization_id, policy_id, created_at DESC) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS consents_customer_idx
      ON consents(organization_id, customer_id, consent_type) WHERE archived_at IS NULL;
    CREATE TRIGGER IF NOT EXISTS customers_organization_guard_insert
    BEFORE INSERT ON customers
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS customers_organization_guard_update
    BEFORE UPDATE OF organization_id ON customers
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS customers_owner_user_guard_insert
    BEFORE INSERT ON customers
    WHEN NEW.owner_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.owner_user_id
          AND organization_id = NEW.organization_id
          AND role <> 'viewer'
      )
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_CUSTOMER_OWNER');
    END;
    CREATE TRIGGER IF NOT EXISTS customers_owner_user_guard_update
    BEFORE UPDATE OF organization_id, owner_user_id ON customers
    WHEN NEW.owner_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.owner_user_id
          AND organization_id = NEW.organization_id
          AND role <> 'viewer'
      )
    BEGIN
      SELECT RAISE(ABORT, 'INVALID_CUSTOMER_OWNER');
    END;
    CREATE TRIGGER IF NOT EXISTS policies_organization_customer_guard_insert
    BEFORE INSERT ON policies
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND organization_id = NEW.organization_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'CUSTOMER_NOT_IN_ORGANIZATION');
    END;
    CREATE TRIGGER IF NOT EXISTS policies_organization_customer_guard_update
    BEFORE UPDATE OF organization_id, customer_id ON policies
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND organization_id = NEW.organization_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'CUSTOMER_NOT_IN_ORGANIZATION');
    END;
    CREATE TRIGGER IF NOT EXISTS events_organization_customer_guard_insert
    BEFORE INSERT ON events
    WHEN NEW.organization_id IS NOT NULL
      AND NEW.customer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND organization_id = NEW.organization_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'CUSTOMER_NOT_IN_ORGANIZATION');
    END;
    CREATE TRIGGER IF NOT EXISTS events_organization_customer_guard_update
    BEFORE UPDATE OF organization_id, customer_id ON events
    WHEN NEW.organization_id IS NOT NULL
      AND NEW.customer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM customers
        WHERE id = NEW.customer_id AND organization_id = NEW.organization_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'CUSTOMER_NOT_IN_ORGANIZATION');
    END;
    CREATE TRIGGER IF NOT EXISTS events_organization_guard_insert
    BEFORE INSERT ON events
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS team_members_organization_guard_insert
    BEFORE INSERT ON team_members
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS team_tasks_organization_guard_insert
    BEFORE INSERT ON team_tasks
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS audit_logs_organization_guard_insert
    BEFORE INSERT ON audit_logs
    WHEN NEW.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.organization_id)
    BEGIN
      SELECT RAISE(ABORT, 'ORGANIZATION_NOT_FOUND');
    END;
    CREATE TRIGGER IF NOT EXISTS attachments_scope_guard_insert
    BEFORE INSERT ON attachments
    WHEN NOT EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NEW.uploaded_by
        AND users.organization_id = NEW.organization_id
    )
      OR (
        NEW.customer_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM customers
          WHERE customers.id = NEW.customer_id
            AND customers.organization_id = NEW.organization_id
        )
      )
      OR (
        NEW.policy_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM policies
          WHERE policies.id = NEW.policy_id
            AND policies.organization_id = NEW.organization_id
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'ATTACHMENT_SCOPE_INVALID');
    END;
  `);
  database.exec(`
    UPDATE customers
    SET owner_user_id = (
      SELECT MIN(users.id)
      FROM users
      WHERE users.organization_id = customers.organization_id
        AND users.display_name = customers.owner
        AND users.active = 1
        AND users.role <> 'viewer'
    )
    WHERE owner_user_id IS NULL
      AND organization_id IS NOT NULL
      AND owner <> ''
      AND (
        SELECT COUNT(*)
        FROM users
        WHERE users.organization_id = customers.organization_id
          AND users.display_name = customers.owner
          AND users.active = 1
          AND users.role <> 'viewer'
      ) = 1
  `);

  ensureSqliteWorkflowSchema(database);

  const mapCustomer = (row) => rowToCustomer(row, dataProtection);
  const mapPolicy = (row) => rowToPolicy(row, dataProtection);
  const mapEvent = (row) => rowToEvent(row, dataProtection);

  const statements = {
    getRevision: database.prepare("SELECT value FROM app_meta WHERE key = 'revision'"),
    setRevision: database.prepare("UPDATE app_meta SET value = ? WHERE key = 'revision'"),
    customers: database.prepare('SELECT * FROM customers ORDER BY next_follow_up, name'),
    customerById: database.prepare('SELECT * FROM customers WHERE id = ?'),
    policies: database.prepare('SELECT * FROM policies ORDER BY updated_at DESC'),
    policyById: database.prepare('SELECT * FROM policies WHERE id = ?'),
    events: database.prepare('SELECT * FROM events ORDER BY event_date, event_time'),
    eventById: database.prepare('SELECT * FROM events WHERE id = ?'),
    members: database.prepare('SELECT * FROM team_members ORDER BY is_owner DESC, name'),
    tasks: database.prepare('SELECT * FROM team_tasks ORDER BY done, due, title'),
    teamGoal: database.prepare("SELECT value FROM app_settings WHERE key = 'teamGoal'"),
    insertCustomer: database.prepare(`
      INSERT INTO customers (
        id, name, phone, email, birthday, owner_user_id, owner, stage, next_follow_up,
        needs, note, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertPolicy: database.prepare(`
      INSERT INTO policies (
        id, customer_id, customer_name, company, policy_number, type,
        start_date, payment_years, coverage, premium, summary, updated_label,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertEvent: database.prepare(`
      INSERT INTO events (
        id, customer_id, title, event_date, event_time, category, reminder,
        detail, note, status, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMember: database.prepare(`
      INSERT INTO team_members (id, name, role, specialty, target, closed, is_owner)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertTask: database.prepare(`
      INSERT INTO team_tasks (id, title, owner, due, done)
      VALUES (?, ?, ?, ?, ?)
    `),
    setTeamGoal: database.prepare(`
      INSERT INTO app_settings (key, value) VALUES ('teamGoal', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `),
    updateCustomer: database.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, email = ?, birthday = ?, owner_user_id = ?, owner = ?, stage = ?,
        next_follow_up = ?, needs = ?, note = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `),
    policyIdsForCustomer: database.prepare('SELECT id FROM policies WHERE customer_id = ?'),
    renamePolicyCustomerById: database.prepare(
      'UPDATE policies SET customer_name = ? WHERE customer_id = ? AND id = ?'
    ),
    deleteCustomer: database.prepare('DELETE FROM customers WHERE id = ? AND version = ?'),
    updatePolicy: database.prepare(`
      UPDATE policies SET
        customer_id = ?, customer_name = ?, company = ?, policy_number = ?, type = ?,
        start_date = ?, payment_years = ?, coverage = ?, premium = ?, summary = ?,
        updated_label = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `),
    deletePolicy: database.prepare('DELETE FROM policies WHERE id = ? AND version = ?'),
    updateEvent: database.prepare(`
      UPDATE events SET
        customer_id = ?, title = ?, event_date = ?, event_time = ?, category = ?,
        reminder = ?, detail = ?, note = ?, status = ?, version = version + 1,
        updated_at = ?
      WHERE id = ? AND version = ?
    `),
    deleteEvent: database.prepare('DELETE FROM events WHERE id = ? AND version = ?'),
    insertAudit: database.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    auditLogs: database.prepare(`
      SELECT id, action, entity_type, entity_id, metadata, created_at
      FROM audit_logs ORDER BY id DESC LIMIT ?
    `),
    countUsers: database.prepare('SELECT COUNT(*) AS count FROM users'),
    insertOrganization: database.prepare(`
      INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)
    `),
    insertUser: database.prepare(`
      INSERT INTO users (
        id, organization_id, display_name, username, password_hash, password_salt,
        role, active, failed_login_attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
    `),
    userById: database.prepare(`
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.id = ?
    `),
    userByUsername: database.prepare(`
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.username = ? COLLATE NOCASE
    `),
    insertSession: database.prepare(`
      INSERT INTO sessions (
        token_hash, user_id, csrf_token, created_at, last_seen_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `),
    sessionByHash: database.prepare(`
      SELECT
        sessions.token_hash, sessions.csrf_token, sessions.created_at,
        sessions.last_seen_at, sessions.expires_at,
        users.id, users.organization_id, users.display_name, users.username,
        users.role, users.active, users.mfa_enabled,
        organizations.name AS organization_name
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      JOIN organizations ON organizations.id = users.organization_id
      WHERE sessions.token_hash = ?
    `),
    touchSession: database.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?'),
    deleteSession: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteExpiredSessions: database.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    loginFailure: database.prepare(`
      UPDATE users
      SET failed_login_attempts = ?, locked_until = ?, updated_at = ?
      WHERE id = ?
    `),
    loginSuccess: database.prepare(`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
      WHERE id = ?
    `),
    organizationRevision: database.prepare(`
      SELECT revision FROM organization_revisions WHERE organization_id = ?
    `),
    createOrganizationRevision: database.prepare(`
      INSERT OR IGNORE INTO organization_revisions (organization_id, revision) VALUES (?, ?)
    `),
    setOrganizationRevision: database.prepare(`
      UPDATE organization_revisions SET revision = ? WHERE organization_id = ?
    `),
    organizationCustomers: database.prepare(`
      SELECT * FROM customers
      WHERE organization_id = ? AND archived_at IS NULL
      ORDER BY next_follow_up, name
    `),
    organizationCustomersForOwner: database.prepare(`
      SELECT * FROM customers
      WHERE organization_id = ? AND owner_user_id = ? AND archived_at IS NULL
      ORDER BY next_follow_up, name
    `),
    organizationCustomerById: database.prepare(`
      SELECT * FROM customers
      WHERE organization_id = ? AND id = ? AND archived_at IS NULL
    `),
    organizationCustomerByIdForOwner: database.prepare(`
      SELECT * FROM customers
      WHERE organization_id = ? AND id = ? AND owner_user_id = ? AND archived_at IS NULL
    `),
    organizationPolicies: database.prepare(`
      SELECT policies.* FROM policies
      JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id
      WHERE policies.organization_id = ?
        AND policies.archived_at IS NULL
        AND customers.archived_at IS NULL
      ORDER BY policies.updated_at DESC
    `),
    organizationPoliciesForOwner: database.prepare(`
      SELECT policies.* FROM policies
      JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id
      WHERE policies.organization_id = ? AND customers.owner_user_id = ?
        AND policies.archived_at IS NULL
        AND customers.archived_at IS NULL
      ORDER BY policies.updated_at DESC
    `),
    organizationPolicyById: database.prepare(`
      SELECT policies.* FROM policies
      JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id
      WHERE policies.organization_id = ? AND policies.id = ?
        AND policies.archived_at IS NULL
        AND customers.archived_at IS NULL
    `),
    organizationPolicyByIdForOwner: database.prepare(`
      SELECT policies.* FROM policies
      JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id
      WHERE policies.organization_id = ? AND policies.id = ? AND customers.owner_user_id = ?
        AND policies.archived_at IS NULL
        AND customers.archived_at IS NULL
    `),
    organizationEvents: database.prepare(`
      SELECT events.* FROM events
      LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id
      WHERE events.organization_id = ?
        AND events.archived_at IS NULL
        AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
      ORDER BY events.event_date, events.event_time
    `),
    organizationEventsForOwner: database.prepare(`
      SELECT events.* FROM events
      LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id
      WHERE events.organization_id = ?
        AND events.archived_at IS NULL
        AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
        AND (
          customers.owner_user_id = ?
          OR (events.customer_id IS NULL AND events.category = 'team')
        )
      ORDER BY events.event_date, events.event_time
    `),
    organizationEventById: database.prepare(`
      SELECT events.* FROM events
      LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id
      WHERE events.organization_id = ? AND events.id = ?
        AND events.archived_at IS NULL
        AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
    `),
    organizationEventByIdForOwner: database.prepare(`
      SELECT events.* FROM events
      LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id
      WHERE events.organization_id = ? AND events.id = ?
        AND events.archived_at IS NULL
        AND (events.customer_id IS NULL OR customers.archived_at IS NULL)
        AND (
          customers.owner_user_id = ?
          OR (events.customer_id IS NULL AND events.category = 'team')
        )
    `),
    organizationMembers: database.prepare(`
      SELECT * FROM team_members
      WHERE organization_id = ? AND archived_at IS NULL
      ORDER BY is_owner DESC, name
    `),
    organizationTasks: database.prepare(`
      SELECT * FROM team_tasks
      WHERE organization_id = ? AND archived_at IS NULL
      ORDER BY done, due, title
    `),
    organizationTeamGoal: database.prepare(`
      SELECT value FROM organization_settings WHERE organization_id = ? AND key = 'teamGoal'
    `),
    setOrganizationTeamGoal: database.prepare(`
      INSERT INTO organization_settings (organization_id, key, value)
      VALUES (?, 'teamGoal', ?)
      ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value
    `),
    deleteOrganizationPolicies: database.prepare('DELETE FROM policies WHERE organization_id = ?'),
    deleteOrganizationEvents: database.prepare('DELETE FROM events WHERE organization_id = ?'),
    deleteOrganizationTasks: database.prepare('DELETE FROM team_tasks WHERE organization_id = ?'),
    deleteOrganizationMembers: database.prepare('DELETE FROM team_members WHERE organization_id = ?'),
    deleteOrganizationCustomers: database.prepare('DELETE FROM customers WHERE organization_id = ?'),
    insertOrganizationCustomer: database.prepare(`
      INSERT INTO customers (
        id, organization_id, name, phone, email, birthday, owner_user_id, owner, stage,
        next_follow_up, needs, note, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertOrganizationPolicy: database.prepare(`
      INSERT INTO policies (
        id, organization_id, customer_id, customer_name, company, policy_number,
        type, start_date, payment_years, coverage, premium, summary, updated_label,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertOrganizationEvent: database.prepare(`
      INSERT INTO events (
        id, organization_id, customer_id, title, event_date, event_time, category,
        reminder, detail, note, status, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertOrganizationMember: database.prepare(`
      INSERT INTO team_members (
        id, organization_id, name, role, specialty, target, closed, is_owner
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertOrganizationTask: database.prepare(`
      INSERT INTO team_tasks (id, organization_id, title, owner, due, done)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    updateOrganizationCustomer: database.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, email = ?, birthday = ?, owner_user_id = ?, owner = ?, stage = ?,
        next_follow_up = ?, needs = ?, note = ?, version = version + 1, updated_at = ?
      WHERE organization_id = ? AND id = ? AND version = ?
    `),
    organizationPolicyIdsForCustomer: database.prepare(`
      SELECT id FROM policies WHERE organization_id = ? AND customer_id = ?
    `),
    renameOrganizationPolicyCustomerById: database.prepare(`
      UPDATE policies SET customer_name = ?
      WHERE organization_id = ? AND customer_id = ? AND id = ?
    `),
    deleteOrganizationCustomer: database.prepare(`
      DELETE FROM customers WHERE organization_id = ? AND id = ? AND version = ?
    `),
    updateOrganizationPolicy: database.prepare(`
      UPDATE policies SET
        customer_id = ?, customer_name = ?, company = ?, policy_number = ?, type = ?,
        start_date = ?, payment_years = ?, coverage = ?, premium = ?, summary = ?,
        updated_label = ?, version = version + 1, updated_at = ?
      WHERE organization_id = ? AND id = ? AND version = ?
    `),
    deleteOrganizationPolicy: database.prepare(`
      DELETE FROM policies WHERE organization_id = ? AND id = ? AND version = ?
    `),
    updateOrganizationEvent: database.prepare(`
      UPDATE events SET
        customer_id = ?, title = ?, event_date = ?, event_time = ?, category = ?,
        reminder = ?, detail = ?, note = ?, status = ?, version = version + 1,
        updated_at = ?
      WHERE organization_id = ? AND id = ? AND version = ?
    `),
    deleteOrganizationEvent: database.prepare(`
      DELETE FROM events WHERE organization_id = ? AND id = ? AND version = ?
    `),
    organizationAuditLogs: database.prepare(`
      SELECT id, action, entity_type, entity_id, metadata, actor_user_id, created_at
      FROM audit_logs
      WHERE organization_id = ?
      ORDER BY id DESC LIMIT ?
    `),
    insertOrganizationAudit: database.prepare(`
      INSERT INTO audit_logs (
        action, entity_type, entity_id, metadata, organization_id, actor_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    organizationUsers: database.prepare(`
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.organization_id = ?
      ORDER BY users.role = 'owner' DESC, users.active DESC, users.display_name
    `),
    organizationUserById: database.prepare(`
      SELECT users.*, organizations.name AS organization_name
      FROM users
      JOIN organizations ON organizations.id = users.organization_id
      WHERE users.organization_id = ? AND users.id = ?
    `),
    updateOrganizationUser: database.prepare(`
      UPDATE users
      SET display_name = ?, role = ?, active = ?, updated_at = ?
      WHERE organization_id = ? AND id = ?
    `),
    renameOrganizationCustomerOwner: database.prepare(`
      UPDATE customers
      SET owner = ?
      WHERE organization_id = ? AND owner_user_id = ?
    `),
    resetOrganizationUserPassword: database.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, failed_login_attempts = 0,
          locked_until = NULL, updated_at = ?
      WHERE organization_id = ? AND id = ?
    `),
    deleteUserSessions: database.prepare('DELETE FROM sessions WHERE user_id = ?'),
    setUserMfaSecret: database.prepare(`
      UPDATE users
      SET mfa_secret_ciphertext = ?, mfa_enabled = 0, mfa_last_counter = NULL,
          updated_at = ?
      WHERE organization_id = ? AND id = ?
    `),
    enableUserMfa: database.prepare(`
      UPDATE users
      SET mfa_enabled = 1, mfa_last_counter = ?, updated_at = ?
      WHERE organization_id = ? AND id = ? AND mfa_secret_ciphertext IS NOT NULL
    `),
    disableUserMfa: database.prepare(`
      UPDATE users
      SET mfa_secret_ciphertext = NULL, mfa_enabled = 0, mfa_last_counter = NULL,
          updated_at = ?
      WHERE organization_id = ? AND id = ?
    `),
    consumeUserTotpCounter: database.prepare(`
      UPDATE users
      SET mfa_last_counter = ?, updated_at = ?
      WHERE id = ? AND mfa_enabled = 1
        AND (mfa_last_counter IS NULL OR mfa_last_counter < ?)
    `),
    deleteRecoveryCodes: database.prepare('DELETE FROM user_recovery_codes WHERE user_id = ?'),
    insertRecoveryCode: database.prepare(`
      INSERT INTO user_recovery_codes (user_id, code_hash, created_at)
      VALUES (?, ?, ?)
    `),
    consumeRecoveryCode: database.prepare(`
      UPDATE user_recovery_codes
      SET used_at = ?
      WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
    `),
    claimLegacyCustomers: database.prepare(`
      UPDATE customers SET organization_id = ? WHERE organization_id IS NULL
    `),
    claimLegacyPolicies: database.prepare(`
      UPDATE policies SET organization_id = ? WHERE organization_id IS NULL
    `),
    claimLegacyEvents: database.prepare(`
      UPDATE events SET organization_id = ? WHERE organization_id IS NULL
    `),
    claimLegacyMembers: database.prepare(`
      UPDATE team_members SET organization_id = ? WHERE organization_id IS NULL
    `),
    claimLegacyTasks: database.prepare(`
      UPDATE team_tasks SET organization_id = ? WHERE organization_id IS NULL
    `),
    claimLegacyAudit: database.prepare(`
      UPDATE audit_logs SET organization_id = ? WHERE organization_id IS NULL
    `),
    allCustomersForProtection: database.prepare('SELECT * FROM customers'),
    allPoliciesForProtection: database.prepare('SELECT * FROM policies'),
    allEventsForProtection: database.prepare('SELECT * FROM events'),
    allAttachmentsForProtection: database.prepare('SELECT * FROM attachments'),
    protectCustomer: database.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, email = ?, birthday = ?, needs = ?, note = ?
      WHERE id = ?
    `),
    protectPolicy: database.prepare(`
      UPDATE policies
      SET customer_name = ?, policy_number = ?, start_date = ?, coverage = ?, premium = ?,
          summary = ?
      WHERE id = ?
    `),
    protectEvent: database.prepare(`
      UPDATE events SET title = ?, detail = ?, note = ? WHERE id = ?
    `),
    protectAttachmentName: database.prepare(`
      UPDATE attachments SET original_name = ? WHERE id = ?
    `),
    insertAttachment: database.prepare(`
      INSERT INTO attachments (
        id, organization_id, uploaded_by, customer_id, policy_id, original_name,
        media_type, size_bytes, sha256, status, storage_key, scan_detail, scanned_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    organizationAttachmentById: database.prepare(`
      SELECT * FROM attachments WHERE organization_id = ? AND id = ?
    `),
    organizationAdvisorAttachmentById: database.prepare(`
      SELECT attachments.* FROM attachments
      LEFT JOIN customers
        ON customers.organization_id = attachments.organization_id
        AND customers.id = attachments.customer_id
      WHERE attachments.organization_id = ?
        AND attachments.id = ?
        AND (
          customers.owner_user_id = ?
          OR (attachments.customer_id IS NULL AND attachments.uploaded_by = ?)
        )
    `),
    organizationAttachments: database.prepare(`
      SELECT * FROM attachments
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `),
    organizationAdvisorAttachments: database.prepare(`
      SELECT attachments.* FROM attachments
      LEFT JOIN customers
        ON customers.organization_id = attachments.organization_id
        AND customers.id = attachments.customer_id
      WHERE attachments.organization_id = ?
        AND (
          customers.owner_user_id = ?
          OR (attachments.customer_id IS NULL AND attachments.uploaded_by = ?)
        )
      ORDER BY attachments.created_at DESC
      LIMIT ?
    `)
  };

  function backfillCustomerOwnerUserIds(organizationId) {
    database.prepare(`
      UPDATE customers
      SET owner_user_id = (
        SELECT MIN(users.id)
        FROM users
        WHERE users.organization_id = customers.organization_id
          AND users.display_name = customers.owner
          AND users.active = 1
          AND users.role <> 'viewer'
      )
      WHERE organization_id = ?
        AND owner_user_id IS NULL
        AND owner <> ''
        AND (
          SELECT COUNT(*)
          FROM users
          WHERE users.organization_id = customers.organization_id
            AND users.display_name = customers.owner
            AND users.active = 1
            AND users.role <> 'viewer'
        ) = 1
    `).run(toText(organizationId));
  }

  function claimLegacyDataForSingleOrganization() {
    const tables = ['customers', 'policies', 'events', 'team_members', 'team_tasks'];
    const unclaimedCount = tables.reduce((total, table) => (
      total + Number(database.prepare(
        `SELECT COUNT(*) AS count FROM ${table} WHERE organization_id IS NULL`
      ).get()?.count || 0)
    ), 0) + Number(database.prepare(
      'SELECT COUNT(*) AS count FROM audit_logs WHERE organization_id IS NULL'
    ).get()?.count || 0);
    const organizations = database.prepare('SELECT id FROM organizations ORDER BY created_at LIMIT 2').all();
    if (organizations.length === 0) return;
    if (organizations.length > 1 && unclaimedCount) {
      throw new Error('LEGACY_DATA_REQUIRES_MANUAL_ORGANIZATION_ASSIGNMENT');
    }
    if (organizations.length > 1) return;

    const organizationId = organizations[0].id;
    database.exec('BEGIN IMMEDIATE');
    try {
      unprotectLegacyUnscopedData();
      statements.claimLegacyCustomers.run(organizationId);
      statements.claimLegacyPolicies.run(organizationId);
      statements.claimLegacyEvents.run(organizationId);
      statements.claimLegacyMembers.run(organizationId);
      statements.claimLegacyTasks.run(organizationId);
      statements.claimLegacyAudit.run(organizationId);
      backfillCustomerOwnerUserIds(organizationId);
      statements.createOrganizationRevision.run(organizationId, Number(
        statements.getRevision.get()?.value || 0
      ));
      const legacyGoal = statements.teamGoal.get()?.value;
      if (legacyGoal !== undefined) {
        statements.setOrganizationTeamGoal.run(organizationId, toText(legacyGoal));
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  claimLegacyDataForSingleOrganization();

  function unprotectLegacyUnscopedData() {
    if (!dataProtection) return;
    for (const row of statements.allCustomersForProtection.all()) {
      if (row.organization_id) continue;
      const fields = unprotectCustomerFields(dataProtection, row);
      statements.protectCustomer.run(
        fields.name,
        fields.phone,
        fields.email,
        fields.birthday,
        fields.needs,
        fields.note,
        row.id
      );
    }
    for (const row of statements.allPoliciesForProtection.all()) {
      if (row.organization_id) continue;
      const fields = unprotectPolicyFields(dataProtection, row);
      statements.protectPolicy.run(
        fields.customer,
        fields.policyNumber,
        fields.startDate,
        fields.coverage,
        fields.premium,
        fields.summary,
        row.id
      );
    }
    for (const row of statements.allEventsForProtection.all()) {
      if (row.organization_id) continue;
      const fields = unprotectEventFields(dataProtection, row);
      statements.protectEvent.run(fields.title, fields.detail, fields.note, row.id);
    }
  }

  function protectSensitiveDataRows() {
    const counts = {
      customers: 0,
      policies: 0,
      events: 0,
      attachments: 0,
      workflow: 0
    };
    for (const row of statements.allCustomersForProtection.all()) {
      if (!row.organization_id) continue;
        const fields = protectCustomerFields(dataProtection, row.organization_id, {
          ...row,
          birthday: row.birthday
        });
        statements.protectCustomer.run(
          fields.name,
          fields.phone,
          fields.email,
          fields.birthdayCiphertext,
          fields.needs,
          fields.note,
          row.id
        );
        counts.customers += 1;
    }
    for (const row of statements.allPoliciesForProtection.all()) {
      if (!row.organization_id) continue;
        const fields = protectPolicyFields(dataProtection, row.organization_id, {
          ...row,
          customerName: row.customer_name,
          policyNumber: row.policy_number,
          startDate: row.start_date
        });
        statements.protectPolicy.run(
          fields.customerName,
          fields.policyNumber,
          fields.startDateCiphertext,
          fields.coverage,
          fields.premium,
          fields.summary,
          row.id
        );
        counts.policies += 1;
    }
    for (const row of statements.allEventsForProtection.all()) {
      if (!row.organization_id) continue;
        const fields = protectEventFields(dataProtection, row.organization_id, row);
        statements.protectEvent.run(fields.title, fields.detail, fields.note, row.id);
        counts.events += 1;
    }
    for (const row of statements.allAttachmentsForProtection.all()) {
      if (!row.organization_id) continue;
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
      statements.protectAttachmentName.run(originalName, row.id);
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
      for (const row of database.prepare(`SELECT rowid AS _rowid, * FROM ${table}`).all()) {
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
          database.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`)
            .run(protectedValue, row._rowid);
          counts.workflow += 1;
        }
      }
    }
    return counts;
  }

  function protectSensitiveData() {
    if (!dataProtection) {
      return { customers: 0, policies: 0, events: 0, attachments: 0, workflow: 0 };
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      const counts = protectSensitiveDataRows();
      database.exec('COMMIT');
      return counts;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  protectSensitiveData();

  function rowToUser(row) {
    const user = publicUser(row);
    if (!user) return null;
    return {
      ...user,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      failedLoginAttempts: row.failed_login_attempts,
      mfaSecretCiphertext: row.mfa_secret_ciphertext,
      mfaLastCounter: row.mfa_last_counter
    };
  }

  function getRevision() {
    return Number(statements.getRevision.get()?.value || 0);
  }

  function incrementRevision() {
    const nextRevision = getRevision() + 1;
    statements.setRevision.run(String(nextRevision));
    return nextRevision;
  }

  function recordAudit(action, entityType, entityId = null, metadata = {}) {
    statements.insertAudit.run(
      toText(action),
      toText(entityType),
      nullableText(entityId),
      JSON.stringify(metadata),
      new Date().toISOString()
    );
  }

  function runMutation(operation) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      if (result?.conflict || result?.notFound) {
        database.exec('ROLLBACK');
        return result;
      }
      const revision = incrementRevision();
      database.exec('COMMIT');
      return { ...result, revision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function getOrganizationRevision(organizationId) {
    const id = toText(organizationId);
    statements.createOrganizationRevision.run(id, 0);
    return Number(statements.organizationRevision.get(id)?.revision || 0);
  }

  function incrementOrganizationRevision(organizationId) {
    const id = toText(organizationId);
    const nextRevision = getOrganizationRevision(id) + 1;
    statements.setOrganizationRevision.run(nextRevision, id);
    incrementRevision();
    return nextRevision;
  }

  function recordOrganizationAudit(
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId = null,
    metadata = {}
  ) {
    statements.insertOrganizationAudit.run(
      toText(action),
      toText(entityType),
      nullableText(entityId),
      JSON.stringify(metadata),
      toText(organizationId),
      nullableText(actorUserId),
      new Date().toISOString()
    );
  }

  function runOrganizationMutation(organizationId, operation) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      if (result?.conflict || result?.notFound) {
        database.exec('ROLLBACK');
        return result;
      }
      const revision = incrementOrganizationRevision(organizationId);
      database.exec('COMMIT');
      return { ...result, revision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  async function runOrganizationAsyncMutation(organizationId, operation) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = await operation(database);
      if (result?.conflict || result?.notFound) {
        database.exec('ROLLBACK');
        return result;
      }
      const revision = incrementOrganizationRevision(organizationId);
      database.exec('COMMIT');
      return { ...result, revision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function organizationContext(organizationId, actorUserId = null) {
    return {
      organizationId: toText(organizationId),
      actorUserId: nullableText(actorUserId)
    };
  }

  function resolveOrganizationCustomerOwner(
    organizationId,
    customer,
    accessUserId = null,
    currentOwnerUserId = null
  ) {
    const ownerUserId = nullableText(customer.ownerUserId);
    const scopedUserId = nullableText(accessUserId);
    if (scopedUserId && ownerUserId !== scopedUserId) {
      throw new Error('CUSTOMER_ACCESS_DENIED');
    }
    if (!ownerUserId) {
      return { ownerUserId: null, owner: toText(customer.owner) };
    }
    const ownerUser = statements.organizationUserById.get(
      toText(organizationId),
      ownerUserId
    );
    if (
      !ownerUser
      || ownerUser.role === 'viewer'
      || (!ownerUser.active && ownerUserId !== nullableText(currentOwnerUserId))
    ) {
      throw new Error('INVALID_CUSTOMER_OWNER');
    }
    return {
      ownerUserId,
      owner: ownerUser.display_name
    };
  }

  function getState() {
    return {
      revision: getRevision(),
      customers: statements.customers.all().map(mapCustomer),
      policies: statements.policies.all().map(mapPolicy),
      events: statements.events.all().map(mapEvent),
      teamMembers: statements.members.all().map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        specialty: row.specialty,
        target: row.target,
        closed: row.closed,
        owner: Boolean(row.is_owner)
      })),
      teamTasks: statements.tasks.all().map((row) => ({
        id: row.id,
        title: row.title,
        owner: row.owner,
        due: row.due,
        done: Boolean(row.done)
      })),
      teamGoal: Number(statements.teamGoal.get()?.value || 0)
    };
  }

  function replaceState(state, expectedRevision) {
    const currentRevision = getRevision();
    if (Number(expectedRevision) !== currentRevision) {
      return { conflict: true, revision: currentRevision };
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(`
        DELETE FROM policies;
        DELETE FROM events;
        DELETE FROM team_tasks;
        DELETE FROM team_members;
        DELETE FROM customers;
      `);

      for (const customer of state.customers) {
        const protectedFields = protectCustomerFields(dataProtection, null, customer);
        statements.insertCustomer.run(
          toText(customer.id),
          protectedFields.name,
          protectedFields.phone,
          protectedFields.email,
          protectedFields.birthdayCiphertext,
          nullableText(customer.ownerUserId),
          toText(customer.owner),
          toText(customer.stage || '新名單'),
          toText(customer.nextFollowUp),
          protectedFields.needs,
          protectedFields.note,
          Number(customer.version || 1),
          toText(customer.createdAt || new Date().toISOString()),
          toText(customer.updatedAt || new Date().toISOString())
        );
      }

      for (const policy of state.policies) {
        const protectedFields = protectPolicyFields(dataProtection, null, policy);
        statements.insertPolicy.run(
          toText(policy.id),
          toText(policy.customerId),
          protectedFields.customerName,
          toText(policy.company),
          protectedFields.policyNumber,
          toText(policy.type),
          protectedFields.startDateCiphertext,
          toText(policy.paymentYears),
          protectedFields.coverage,
          protectedFields.premium,
          protectedFields.summary,
          toText(policy.updated),
          Number(policy.version || 1),
          toText(policy.createdAt || new Date().toISOString()),
          toText(policy.updatedAt || new Date().toISOString())
        );
      }

      for (const event of state.events) {
        const protectedFields = protectEventFields(dataProtection, null, event);
        statements.insertEvent.run(
          toText(event.id),
          nullableText(event.customerId),
          protectedFields.title,
          toText(event.date),
          toText(event.time),
          toText(event.category),
          toText(event.reminder || '15 分鐘前'),
          protectedFields.detail,
          protectedFields.note,
          toText(event.status || 'scheduled'),
          Number(event.version || 1),
          toText(event.createdAt || new Date().toISOString()),
          toText(event.updatedAt || new Date().toISOString())
        );
      }

      for (const member of state.teamMembers) {
        statements.insertMember.run(
          toText(member.id),
          toText(member.name),
          toText(member.role),
          toText(member.specialty),
          Number(member.target || 0),
          Number(member.closed || 0),
          member.owner ? 1 : 0
        );
      }

      for (const task of state.teamTasks) {
        statements.insertTask.run(
          toText(task.id),
          toText(task.title),
          toText(task.owner),
          toText(task.due),
          task.done ? 1 : 0
        );
      }

      statements.setTeamGoal.run(String(Number(state.teamGoal || 0)));
      recordAudit('replace', 'application_state', null, {
        customers: state.customers.length,
        policies: state.policies.length,
        events: state.events.length
      });
      const nextRevision = incrementRevision();
      database.exec('COMMIT');
      return { conflict: false, revision: nextRevision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function getOrganizationState(organizationId, accessUserId = null) {
    const organization = toText(organizationId);
    return {
      revision: getOrganizationRevision(organization),
      customers: listOrganizationCustomers(organization, accessUserId),
      policies: listOrganizationPolicies(organization, accessUserId),
      events: listOrganizationEvents(organization, accessUserId),
      teamMembers: statements.organizationMembers.all(organization).map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        specialty: row.specialty,
        target: row.target,
        closed: row.closed,
        owner: Boolean(row.is_owner)
      })),
      teamTasks: statements.organizationTasks.all(organization).map((row) => ({
        id: row.id,
        title: row.title,
        owner: row.owner,
        due: row.due,
        done: Boolean(row.done)
      })),
      teamGoal: Number(statements.organizationTeamGoal.get(organization)?.value || 0)
    };
  }

  function replaceOrganizationState(organizationId, actorUserId, state, expectedRevision) {
    const context = organizationContext(organizationId, actorUserId);
    const currentRevision = getOrganizationRevision(context.organizationId);
    if (Number(expectedRevision) !== currentRevision) {
      return { conflict: true, revision: currentRevision };
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      statements.deleteOrganizationPolicies.run(context.organizationId);
      statements.deleteOrganizationEvents.run(context.organizationId);
      statements.deleteOrganizationTasks.run(context.organizationId);
      statements.deleteOrganizationMembers.run(context.organizationId);
      statements.deleteOrganizationCustomers.run(context.organizationId);

      const now = new Date().toISOString();
      for (const customer of state.customers) {
        const assignedOwner = resolveOrganizationCustomerOwner(
          context.organizationId,
          customer
        );
        const protectedFields = protectCustomerFields(
          dataProtection,
          context.organizationId,
          customer
        );
        statements.insertOrganizationCustomer.run(
          toText(customer.id),
          context.organizationId,
          protectedFields.name,
          protectedFields.phone,
          protectedFields.email,
          protectedFields.birthdayCiphertext,
          assignedOwner.ownerUserId,
          assignedOwner.owner,
          toText(customer.stage || '新名單'),
          toText(customer.nextFollowUp),
          protectedFields.needs,
          protectedFields.note,
          Number(customer.version || 1),
          toText(customer.createdAt || now),
          toText(customer.updatedAt || now)
        );
      }

      for (const policy of state.policies) {
        if (!statements.organizationCustomerById.get(context.organizationId, toText(policy.customerId))) {
          throw new Error('CUSTOMER_NOT_IN_ORGANIZATION');
        }
        const protectedFields = protectPolicyFields(
          dataProtection,
          context.organizationId,
          policy
        );
        statements.insertOrganizationPolicy.run(
          toText(policy.id),
          context.organizationId,
          toText(policy.customerId),
          protectedFields.customerName,
          toText(policy.company),
          protectedFields.policyNumber,
          toText(policy.type),
          protectedFields.startDateCiphertext,
          toText(policy.paymentYears),
          protectedFields.coverage,
          protectedFields.premium,
          protectedFields.summary,
          toText(policy.updated),
          Number(policy.version || 1),
          toText(policy.createdAt || now),
          toText(policy.updatedAt || now)
        );
      }

      for (const event of state.events) {
        if (
          event.customerId
          && !statements.organizationCustomerById.get(context.organizationId, toText(event.customerId))
        ) {
          throw new Error('CUSTOMER_NOT_IN_ORGANIZATION');
        }
        const protectedFields = protectEventFields(
          dataProtection,
          context.organizationId,
          event
        );
        statements.insertOrganizationEvent.run(
          toText(event.id),
          context.organizationId,
          nullableText(event.customerId),
          protectedFields.title,
          toText(event.date),
          toText(event.time),
          toText(event.category),
          toText(event.reminder || '15 分鐘前'),
          protectedFields.detail,
          protectedFields.note,
          toText(event.status || 'scheduled'),
          Number(event.version || 1),
          toText(event.createdAt || now),
          toText(event.updatedAt || now)
        );
      }

      for (const member of state.teamMembers) {
        statements.insertOrganizationMember.run(
          toText(member.id),
          context.organizationId,
          toText(member.name),
          toText(member.role),
          toText(member.specialty),
          Number(member.target || 0),
          Number(member.closed || 0),
          member.owner ? 1 : 0
        );
      }

      for (const task of state.teamTasks) {
        statements.insertOrganizationTask.run(
          toText(task.id),
          context.organizationId,
          toText(task.title),
          toText(task.owner),
          toText(task.due),
          task.done ? 1 : 0
        );
      }

      statements.setOrganizationTeamGoal.run(
        context.organizationId,
        String(Number(state.teamGoal || 0))
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'replace',
        'application_state',
        null,
        {
          customers: state.customers.length,
          policies: state.policies.length,
          events: state.events.length
        }
      );
      const revision = incrementOrganizationRevision(context.organizationId);
      database.exec('COMMIT');
      return { conflict: false, revision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function replaceOrganizationTeamState(
    organizationId,
    actorUserId,
    state,
    expectedRevision
  ) {
    const context = organizationContext(organizationId, actorUserId);
    const currentRevision = getOrganizationRevision(context.organizationId);
    if (Number(expectedRevision) !== currentRevision) {
      return { conflict: true, revision: currentRevision };
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      statements.deleteOrganizationTasks.run(context.organizationId);
      statements.deleteOrganizationMembers.run(context.organizationId);
      const now = new Date().toISOString();
      for (const member of state.teamMembers) {
        statements.insertOrganizationMember.run(
          toText(member.id),
          context.organizationId,
          toText(member.name),
          toText(member.role),
          toText(member.specialty),
          Number(member.target || 0),
          Number(member.closed || 0),
          member.owner ? 1 : 0
        );
        database.prepare(`
          UPDATE team_members SET created_at = ?, updated_at = ?
          WHERE organization_id = ? AND id = ?
        `).run(now, now, context.organizationId, toText(member.id));
      }
      for (const task of state.teamTasks) {
        statements.insertOrganizationTask.run(
          toText(task.id),
          context.organizationId,
          toText(task.title),
          toText(task.owner),
          toText(task.due),
          task.done ? 1 : 0
        );
        database.prepare(`
          UPDATE team_tasks SET created_at = ?, updated_at = ?
          WHERE organization_id = ? AND id = ?
        `).run(now, now, context.organizationId, toText(task.id));
      }
      statements.setOrganizationTeamGoal.run(
        context.organizationId,
        String(Number(state.teamGoal || 0))
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'replace',
        'team_state',
        null,
        {
          members: state.teamMembers.length,
          tasks: state.teamTasks.length
        }
      );
      const revision = incrementOrganizationRevision(context.organizationId);
      database.exec('COMMIT');
      return { conflict: false, revision };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function listOrganizationCustomers(organizationId, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const rows = scopedUserId
      ? statements.organizationCustomersForOwner.all(organization, scopedUserId)
      : statements.organizationCustomers.all(organization);
    return rows.map(mapCustomer);
  }

  function getOrganizationCustomer(organizationId, id, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const row = scopedUserId
      ? statements.organizationCustomerByIdForOwner.get(organization, toText(id), scopedUserId)
      : statements.organizationCustomerById.get(organization, toText(id));
    return row ? mapCustomer(row) : null;
  }

  function requireOrganizationCustomerAccess(organizationId, id, accessUserId = null) {
    const accessible = getOrganizationCustomer(organizationId, id, accessUserId);
    if (accessible) return accessible;
    if (accessUserId && getOrganizationCustomer(organizationId, id)) {
      throw new Error('CUSTOMER_ACCESS_DENIED');
    }
    throw new Error('CUSTOMER_NOT_IN_ORGANIZATION');
  }

  function createOrganizationCustomer(
    organizationId,
    actorUserId,
    customer,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const now = new Date().toISOString();
      const assignedOwner = resolveOrganizationCustomerOwner(
        context.organizationId,
        customer,
        accessUserId
      );
      const protectedFields = protectCustomerFields(
        dataProtection,
        context.organizationId,
        customer
      );
      statements.insertOrganizationCustomer.run(
        toText(customer.id),
        context.organizationId,
        protectedFields.name,
        protectedFields.phone,
        protectedFields.email,
        protectedFields.birthdayCiphertext,
        assignedOwner.ownerUserId,
        assignedOwner.owner,
        toText(customer.stage || '新名單'),
        toText(customer.nextFollowUp),
        protectedFields.needs,
        protectedFields.note,
        1,
        toText(customer.createdAt || now),
        now
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'create',
        'customer',
        customer.id,
        { version: 1 }
      );
      return {
        item: getOrganizationCustomer(context.organizationId, customer.id, accessUserId)
      };
    });
  }

  function updateOrganizationCustomer(
    organizationId,
    actorUserId,
    id,
    customer,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationCustomer(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const assignedOwner = resolveOrganizationCustomerOwner(
        context.organizationId,
        customer,
        accessUserId,
        current.ownerUserId
      );
      const protectedFields = protectCustomerFields(
        dataProtection,
        context.organizationId,
        { ...customer, id }
      );
      const result = statements.updateOrganizationCustomer.run(
        protectedFields.name,
        protectedFields.phone,
        protectedFields.email,
        protectedFields.birthdayCiphertext,
        assignedOwner.ownerUserId,
        assignedOwner.owner,
        toText(customer.stage || '新名單'),
        toText(customer.nextFollowUp),
        protectedFields.needs,
        protectedFields.note,
        new Date().toISOString(),
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationCustomer(context.organizationId, id, accessUserId)
        };
      }
      for (const policyRow of statements.organizationPolicyIdsForCustomer.all(
        context.organizationId,
        toText(id)
      )) {
        const policyFields = protectPolicyFields(dataProtection, context.organizationId, {
          id: policyRow.id,
          customer: customer.name
        });
        statements.renameOrganizationPolicyCustomerById.run(
          policyFields.customerName,
          context.organizationId,
          toText(id),
          policyRow.id
        );
      }
      database.prepare(`
        DELETE FROM search_tokens
        WHERE organization_id = ? AND (
          (entity_type = 'customer' AND entity_id = ?)
          OR customer_id = ?
        )
      `).run(context.organizationId, toText(id), toText(id));
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'update',
        'customer',
        id,
        { fromVersion: Number(expectedVersion), toVersion: Number(expectedVersion) + 1 }
      );
      return { item: getOrganizationCustomer(context.organizationId, id, accessUserId) };
    });
  }

  function deleteOrganizationCustomer(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationCustomer(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deleteOrganizationCustomer.run(
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationCustomer(context.organizationId, id, accessUserId)
        };
      }
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'delete',
        'customer',
        id,
        { version: Number(expectedVersion) }
      );
      return { deletedId: toText(id) };
    });
  }

  function listOrganizationPolicies(organizationId, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const rows = scopedUserId
      ? statements.organizationPoliciesForOwner.all(organization, scopedUserId)
      : statements.organizationPolicies.all(organization);
    return rows.map(mapPolicy);
  }

  function getOrganizationPolicy(organizationId, id, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const row = scopedUserId
      ? statements.organizationPolicyByIdForOwner.get(organization, toText(id), scopedUserId)
      : statements.organizationPolicyById.get(organization, toText(id));
    return row ? mapPolicy(row) : null;
  }

  function createOrganizationPolicy(organizationId, actorUserId, policy, accessUserId = null) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      requireOrganizationCustomerAccess(
        context.organizationId,
        policy.customerId,
        accessUserId
      );
      const now = new Date().toISOString();
      const protectedFields = protectPolicyFields(
        dataProtection,
        context.organizationId,
        policy
      );
      statements.insertOrganizationPolicy.run(
        toText(policy.id),
        context.organizationId,
        toText(policy.customerId),
        protectedFields.customerName,
        toText(policy.company),
        protectedFields.policyNumber,
        toText(policy.type),
        protectedFields.startDateCiphertext,
        toText(policy.paymentYears),
        protectedFields.coverage,
        protectedFields.premium,
        protectedFields.summary,
        toText(policy.updated),
        1,
        toText(policy.createdAt || now),
        now
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'create',
        'policy',
        policy.id,
        { customerId: toText(policy.customerId), version: 1 }
      );
      return { item: getOrganizationPolicy(context.organizationId, policy.id, accessUserId) };
    });
  }

  function updateOrganizationPolicy(
    organizationId,
    actorUserId,
    id,
    policy,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationPolicy(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      requireOrganizationCustomerAccess(
        context.organizationId,
        policy.customerId,
        accessUserId
      );
      const protectedFields = protectPolicyFields(
        dataProtection,
        context.organizationId,
        { ...policy, id }
      );
      const result = statements.updateOrganizationPolicy.run(
        toText(policy.customerId),
        protectedFields.customerName,
        toText(policy.company),
        protectedFields.policyNumber,
        toText(policy.type),
        protectedFields.startDateCiphertext,
        toText(policy.paymentYears),
        protectedFields.coverage,
        protectedFields.premium,
        protectedFields.summary,
        toText(policy.updated),
        new Date().toISOString(),
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationPolicy(context.organizationId, id, accessUserId)
        };
      }
      database.prepare(`
        DELETE FROM search_tokens
        WHERE organization_id = ? AND entity_type = 'policy' AND entity_id = ?
      `).run(context.organizationId, toText(id));
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'update',
        'policy',
        id,
        { fromVersion: Number(expectedVersion), toVersion: Number(expectedVersion) + 1 }
      );
      return { item: getOrganizationPolicy(context.organizationId, id, accessUserId) };
    });
  }

  function deleteOrganizationPolicy(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationPolicy(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deleteOrganizationPolicy.run(
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationPolicy(context.organizationId, id, accessUserId)
        };
      }
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'delete',
        'policy',
        id,
        { version: Number(expectedVersion) }
      );
      return { deletedId: toText(id) };
    });
  }

  function listOrganizationEvents(organizationId, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const rows = scopedUserId
      ? statements.organizationEventsForOwner.all(organization, scopedUserId)
      : statements.organizationEvents.all(organization);
    return rows.map(mapEvent);
  }

  function getOrganizationEvent(organizationId, id, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const row = scopedUserId
      ? statements.organizationEventByIdForOwner.get(organization, toText(id), scopedUserId)
      : statements.organizationEventById.get(organization, toText(id));
    return row ? mapEvent(row) : null;
  }

  function createOrganizationEvent(organizationId, actorUserId, event, accessUserId = null) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      if (accessUserId && !event.customerId && event.category !== 'team') {
        throw new Error('CUSTOMER_ACCESS_DENIED');
      }
      if (event.customerId) {
        requireOrganizationCustomerAccess(
          context.organizationId,
          event.customerId,
          accessUserId
        );
      }
      const now = new Date().toISOString();
      const protectedFields = protectEventFields(
        dataProtection,
        context.organizationId,
        event
      );
      statements.insertOrganizationEvent.run(
        toText(event.id),
        context.organizationId,
        nullableText(event.customerId),
        protectedFields.title,
        toText(event.date),
        toText(event.time),
        toText(event.category),
        toText(event.reminder || '15 分鐘前'),
        protectedFields.detail,
        protectedFields.note,
        toText(event.status || 'scheduled'),
        1,
        toText(event.createdAt || now),
        now
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'create',
        'event',
        event.id,
        { status: toText(event.status || 'scheduled'), version: 1 }
      );
      return { item: getOrganizationEvent(context.organizationId, event.id, accessUserId) };
    });
  }

  function updateOrganizationEvent(
    organizationId,
    actorUserId,
    id,
    event,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationEvent(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      if (accessUserId && !event.customerId && event.category !== 'team') {
        throw new Error('CUSTOMER_ACCESS_DENIED');
      }
      if (event.customerId) {
        requireOrganizationCustomerAccess(
          context.organizationId,
          event.customerId,
          accessUserId
        );
      }
      const protectedFields = protectEventFields(
        dataProtection,
        context.organizationId,
        { ...event, id }
      );
      const result = statements.updateOrganizationEvent.run(
        nullableText(event.customerId),
        protectedFields.title,
        toText(event.date),
        toText(event.time),
        toText(event.category),
        toText(event.reminder || '15 分鐘前'),
        protectedFields.detail,
        protectedFields.note,
        toText(event.status || 'scheduled'),
        new Date().toISOString(),
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationEvent(context.organizationId, id, accessUserId)
        };
      }
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'update',
        'event',
        id,
        {
          fromVersion: Number(expectedVersion),
          toVersion: Number(expectedVersion) + 1,
          status: toText(event.status || 'scheduled')
        }
      );
      return { item: getOrganizationEvent(context.organizationId, id, accessUserId) };
    });
  }

  function deleteOrganizationEvent(
    organizationId,
    actorUserId,
    id,
    expectedVersion,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationEvent(context.organizationId, id, accessUserId);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deleteOrganizationEvent.run(
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationEvent(context.organizationId, id, accessUserId)
        };
      }
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'delete',
        'event',
        id,
        { version: Number(expectedVersion) }
      );
      return { deletedId: toText(id) };
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

  function phase2ResourceQuery(resourceName, organizationId, accessUserId, {
    archived = 'active',
    cursor = null,
    filters = {},
    limit = 50,
    sortDirection = 'desc'
  } = {}) {
    const configuration = phase2ResourceConfiguration(resourceName);
    const alias = configuration.alias;
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const values = [organization];
    const conditions = [`${alias}.organization_id = ?`];
    let from = `${configuration.table} AS ${alias}`;

    if (resourceName === 'policies') {
      from += ` JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id`;
      if (scopedUserId) {
        conditions.push('customers.owner_user_id = ?');
        values.push(scopedUserId);
      }
      if (archived === 'active') conditions.push('customers.archived_at IS NULL');
    } else if (resourceName === 'events') {
      from += ` LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id`;
      if (scopedUserId) {
        conditions.push(`(
          customers.owner_user_id = ?
          OR (events.customer_id IS NULL AND events.category = 'team')
        )`);
        values.push(scopedUserId);
      }
      if (archived === 'active') {
        conditions.push('(events.customer_id IS NULL OR customers.archived_at IS NULL)');
      }
    } else if (scopedUserId) {
      conditions.push('customers.owner_user_id = ?');
      values.push(scopedUserId);
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
      conditions.push(`${column} = ?`);
      values.push(value);
    }

    const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
    if (cursor?.updatedAt && cursor?.id) {
      const comparison = direction === 'ASC' ? '>' : '<';
      conditions.push(
        `(${alias}.updated_at ${comparison} ? OR (${alias}.updated_at = ? AND ${alias}.id > ?))`
      );
      values.push(toText(cursor.updatedAt), toText(cursor.updatedAt), toText(cursor.id));
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    values.push(safeLimit + 1);
    const rows = database.prepare(`
      SELECT ${alias}.*
      FROM ${from}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${alias}.updated_at ${direction}, ${alias}.id ASC
      LIMIT ?
    `).all(...values);
    return {
      hasMore: rows.length > safeLimit,
      items: rows.slice(0, safeLimit).map(configuration.map)
    };
  }

  function listOrganizationResourcePage(
    resourceName,
    organizationId,
    accessUserId = null,
    options = {}
  ) {
    return phase2ResourceQuery(
      resourceName,
      organizationId,
      accessUserId,
      options
    );
  }

  function getOrganizationResourceIncludingArchived(
    resourceName,
    organizationId,
    id,
    accessUserId = null
  ) {
    const page = phase2ResourceQuery(resourceName, organizationId, accessUserId, {
      archived: 'all',
      filters: {},
      limit: 100
    });
    const item = page.items.find((candidate) => candidate.id === toText(id));
    if (item) return item;

    const configuration = phase2ResourceConfiguration(resourceName);
    const alias = configuration.alias;
    const scopedUserId = nullableText(accessUserId);
    const values = [toText(organizationId), toText(id)];
    const conditions = [`${alias}.organization_id = ?`, `${alias}.id = ?`];
    let from = `${configuration.table} AS ${alias}`;
    if (resourceName === 'policies') {
      from += ` JOIN customers
        ON customers.organization_id = policies.organization_id
        AND customers.id = policies.customer_id`;
      if (scopedUserId) {
        conditions.push('customers.owner_user_id = ?');
        values.push(scopedUserId);
      }
    } else if (resourceName === 'events') {
      from += ` LEFT JOIN customers
        ON customers.organization_id = events.organization_id
        AND customers.id = events.customer_id`;
      if (scopedUserId) {
        conditions.push(`(
          customers.owner_user_id = ?
          OR (events.customer_id IS NULL AND events.category = 'team')
        )`);
        values.push(scopedUserId);
      }
    } else if (scopedUserId) {
      conditions.push('customers.owner_user_id = ?');
      values.push(scopedUserId);
    }
    const row = database.prepare(`
      SELECT ${alias}.* FROM ${from} WHERE ${conditions.join(' AND ')}
    `).get(...values);
    return row ? configuration.map(row) : null;
  }

  function setOrganizationResourceArchived(
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
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      const current = getOrganizationResourceIncludingArchived(
        resourceName,
        context.organizationId,
        id,
        accessUserId
      );
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) {
        return { conflict: true, item: current };
      }
      const archivedAt = archived ? new Date().toISOString() : null;
      const result = database.prepare(`
        UPDATE ${configuration.table}
        SET archived_at = ?, version = version + 1, updated_at = ?
        WHERE organization_id = ? AND id = ? AND version = ?
      `).run(
        archivedAt,
        new Date().toISOString(),
        context.organizationId,
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) {
        return {
          conflict: true,
          item: getOrganizationResourceIncludingArchived(
            resourceName,
            context.organizationId,
            id,
            accessUserId
          )
        };
      }
      if (resourceName === 'customers') {
        database.prepare(`
          DELETE FROM search_tokens
          WHERE organization_id = ? AND customer_id = ?
        `).run(context.organizationId, toText(id));
      } else if (resourceName === 'policies') {
        database.prepare(`
          DELETE FROM search_tokens
          WHERE organization_id = ? AND entity_type = 'policy' AND entity_id = ?
        `).run(context.organizationId, toText(id));
      }
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        archived ? 'archive' : 'restore',
        resourceName.slice(0, -1),
        id,
        {
          ...metadata,
          fromVersion: Number(expectedVersion),
          toVersion: Number(expectedVersion) + 1
        }
      );
      return {
        item: getOrganizationResourceIncludingArchived(
          resourceName,
          context.organizationId,
          id,
          accessUserId
        )
      };
    });
  }

  function recordOrganizationApiAudit(
    organizationId,
    actorUserId,
    action,
    entityType,
    entityId = null,
    metadata = {}
  ) {
    recordOrganizationAudit(
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata
    );
  }

  function listCustomers() {
    return statements.customers.all().map(mapCustomer);
  }

  function getCustomer(id) {
    const row = statements.customerById.get(toText(id));
    return row ? mapCustomer(row) : null;
  }

  function createCustomer(customer) {
    return runMutation(() => {
      const now = new Date().toISOString();
      const protectedFields = protectCustomerFields(dataProtection, null, customer);
      statements.insertCustomer.run(
        toText(customer.id),
        protectedFields.name,
        protectedFields.phone,
        protectedFields.email,
        protectedFields.birthdayCiphertext,
        nullableText(customer.ownerUserId),
        toText(customer.owner),
        toText(customer.stage || '新名單'),
        toText(customer.nextFollowUp),
        protectedFields.needs,
        protectedFields.note,
        1,
        toText(customer.createdAt || now),
        now
      );
      recordAudit('create', 'customer', customer.id, { version: 1 });
      return { item: getCustomer(customer.id) };
    });
  }

  function updateCustomer(id, customer, expectedVersion) {
    return runMutation(() => {
      const current = getCustomer(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const protectedFields = protectCustomerFields(dataProtection, null, { ...customer, id });
      const result = statements.updateCustomer.run(
        protectedFields.name,
        protectedFields.phone,
        protectedFields.email,
        protectedFields.birthdayCiphertext,
        nullableText(customer.ownerUserId),
        toText(customer.owner),
        toText(customer.stage || '新名單'),
        toText(customer.nextFollowUp),
        protectedFields.needs,
        protectedFields.note,
        new Date().toISOString(),
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) return { conflict: true, item: getCustomer(id) };
      for (const policyRow of statements.policyIdsForCustomer.all(toText(id))) {
        const policyFields = protectPolicyFields(dataProtection, null, {
          id: policyRow.id,
          customer: customer.name
        });
        statements.renamePolicyCustomerById.run(
          policyFields.customerName,
          toText(id),
          policyRow.id
        );
      }
      recordAudit('update', 'customer', id, { fromVersion: Number(expectedVersion), toVersion: Number(expectedVersion) + 1 });
      return { item: getCustomer(id) };
    });
  }

  function deleteCustomer(id, expectedVersion) {
    return runMutation(() => {
      const current = getCustomer(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deleteCustomer.run(toText(id), Number(expectedVersion));
      if (!result.changes) return { conflict: true, item: getCustomer(id) };
      recordAudit('delete', 'customer', id, { version: Number(expectedVersion) });
      return { deletedId: toText(id) };
    });
  }

  function listPolicies() {
    return statements.policies.all().map(mapPolicy);
  }

  function getPolicy(id) {
    const row = statements.policyById.get(toText(id));
    return row ? mapPolicy(row) : null;
  }

  function createPolicy(policy) {
    return runMutation(() => {
      const now = new Date().toISOString();
      const protectedFields = protectPolicyFields(dataProtection, null, policy);
      statements.insertPolicy.run(
        toText(policy.id),
        toText(policy.customerId),
        protectedFields.customerName,
        toText(policy.company),
        protectedFields.policyNumber,
        toText(policy.type),
        protectedFields.startDateCiphertext,
        toText(policy.paymentYears),
        protectedFields.coverage,
        protectedFields.premium,
        protectedFields.summary,
        toText(policy.updated),
        1,
        toText(policy.createdAt || now),
        now
      );
      recordAudit('create', 'policy', policy.id, { customerId: toText(policy.customerId), version: 1 });
      return { item: getPolicy(policy.id) };
    });
  }

  function updatePolicy(id, policy, expectedVersion) {
    return runMutation(() => {
      const current = getPolicy(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const protectedFields = protectPolicyFields(dataProtection, null, { ...policy, id });
      const result = statements.updatePolicy.run(
        toText(policy.customerId),
        protectedFields.customerName,
        toText(policy.company),
        protectedFields.policyNumber,
        toText(policy.type),
        protectedFields.startDateCiphertext,
        toText(policy.paymentYears),
        protectedFields.coverage,
        protectedFields.premium,
        protectedFields.summary,
        toText(policy.updated),
        new Date().toISOString(),
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) return { conflict: true, item: getPolicy(id) };
      recordAudit('update', 'policy', id, { fromVersion: Number(expectedVersion), toVersion: Number(expectedVersion) + 1 });
      return { item: getPolicy(id) };
    });
  }

  function deletePolicy(id, expectedVersion) {
    return runMutation(() => {
      const current = getPolicy(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deletePolicy.run(toText(id), Number(expectedVersion));
      if (!result.changes) return { conflict: true, item: getPolicy(id) };
      recordAudit('delete', 'policy', id, { version: Number(expectedVersion) });
      return { deletedId: toText(id) };
    });
  }

  function listEvents() {
    return statements.events.all().map(mapEvent);
  }

  function getEvent(id) {
    const row = statements.eventById.get(toText(id));
    return row ? mapEvent(row) : null;
  }

  function createEvent(event) {
    return runMutation(() => {
      const now = new Date().toISOString();
      const protectedFields = protectEventFields(dataProtection, null, event);
      statements.insertEvent.run(
        toText(event.id),
        nullableText(event.customerId),
        protectedFields.title,
        toText(event.date),
        toText(event.time),
        toText(event.category),
        toText(event.reminder || '15 分鐘前'),
        protectedFields.detail,
        protectedFields.note,
        toText(event.status || 'scheduled'),
        1,
        toText(event.createdAt || now),
        now
      );
      recordAudit('create', 'event', event.id, { status: toText(event.status || 'scheduled'), version: 1 });
      return { item: getEvent(event.id) };
    });
  }

  function updateEvent(id, event, expectedVersion) {
    return runMutation(() => {
      const current = getEvent(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const protectedFields = protectEventFields(dataProtection, null, { ...event, id });
      const result = statements.updateEvent.run(
        nullableText(event.customerId),
        protectedFields.title,
        toText(event.date),
        toText(event.time),
        toText(event.category),
        toText(event.reminder || '15 分鐘前'),
        protectedFields.detail,
        protectedFields.note,
        toText(event.status || 'scheduled'),
        new Date().toISOString(),
        toText(id),
        Number(expectedVersion)
      );
      if (!result.changes) return { conflict: true, item: getEvent(id) };
      recordAudit('update', 'event', id, {
        fromVersion: Number(expectedVersion),
        toVersion: Number(expectedVersion) + 1,
        status: toText(event.status || 'scheduled')
      });
      return { item: getEvent(id) };
    });
  }

  function deleteEvent(id, expectedVersion) {
    return runMutation(() => {
      const current = getEvent(id);
      if (!current) return { notFound: true };
      if (Number(expectedVersion) !== current.version) return { conflict: true, item: current };
      const result = statements.deleteEvent.run(toText(id), Number(expectedVersion));
      if (!result.changes) return { conflict: true, item: getEvent(id) };
      recordAudit('delete', 'event', id, { version: Number(expectedVersion) });
      return { deletedId: toText(id) };
    });
  }

  function listAuditLogs(limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return statements.auditLogs.all(safeLimit).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at
    }));
  }

  function listOrganizationAuditLogs(organizationId, limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return statements.organizationAuditLogs.all(toText(organizationId), safeLimit).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: JSON.parse(row.metadata || '{}'),
      actorUserId: row.actor_user_id,
      createdAt: row.created_at
    }));
  }

  function rowToAttachment(row) {
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
      scannedAt: row.scanned_at,
      createdAt: row.created_at
    };
  }

  function getOrganizationAttachment(organizationId, id, accessUserId = null) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const row = scopedUserId
      ? statements.organizationAdvisorAttachmentById.get(
        organization,
        toText(id),
        scopedUserId,
        scopedUserId
      )
      : statements.organizationAttachmentById.get(organization, toText(id));
    return rowToAttachment(row);
  }

  function listOrganizationAttachments(organizationId, accessUserId = null, limit = 100) {
    const organization = toText(organizationId);
    const scopedUserId = nullableText(accessUserId);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const rows = scopedUserId
      ? statements.organizationAdvisorAttachments.all(
        organization,
        scopedUserId,
        scopedUserId,
        safeLimit
      )
      : statements.organizationAttachments.all(organization, safeLimit);
    return rows.map(rowToAttachment);
  }

  function listAttachmentsForMaintenance() {
    return statements.allAttachmentsForProtection.all().map(rowToAttachment);
  }

  function createOrganizationAttachment(
    organizationId,
    actorUserId,
    attachment,
    accessUserId = null
  ) {
    const context = organizationContext(organizationId, actorUserId);
    return runOrganizationMutation(context.organizationId, () => {
      if (attachment.customerId) {
        requireOrganizationCustomerAccess(
          context.organizationId,
          attachment.customerId,
          accessUserId
        );
      }
      if (attachment.policyId) {
        const policy = getOrganizationPolicy(
          context.organizationId,
          attachment.policyId,
          accessUserId
        );
        if (!policy) throw new Error('POLICY_NOT_IN_ORGANIZATION');
      }
      const originalName = dataProtection
        ? dataProtection.protectText(attachment.originalName, {
          organizationId: context.organizationId,
          entityType: 'attachment',
          entityId: attachment.id,
          field: 'originalName'
        })
        : toText(attachment.originalName);
      statements.insertAttachment.run(
        toText(attachment.id),
        context.organizationId,
        toText(actorUserId),
        nullableText(attachment.customerId),
        nullableText(attachment.policyId),
        originalName,
        toText(attachment.mediaType),
        Number(attachment.sizeBytes),
        toText(attachment.sha256),
        toText(attachment.status),
        toText(attachment.storageKey),
        toText(attachment.scanDetail),
        nullableText(attachment.scannedAt),
        toText(attachment.createdAt || new Date().toISOString())
      );
      recordOrganizationAudit(
        context.organizationId,
        context.actorUserId,
        'create',
        'attachment',
        attachment.id,
        {
          customerId: nullableText(attachment.customerId),
          mediaType: toText(attachment.mediaType),
          sizeBytes: Number(attachment.sizeBytes),
          status: toText(attachment.status)
        }
      );
      return {
        item: getOrganizationAttachment(
          context.organizationId,
          attachment.id,
          accessUserId
        )
      };
    });
  }

  function verifyIntegrity() {
    return database.prepare('PRAGMA integrity_check').all().map((row) => Object.values(row)[0]);
  }

  function phase2MigrationReport() {
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
    const existingTables = new Set(database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table'
    `).all().map((row) => row.name));
    const counts = {};
    for (const table of ['customers', 'policies', 'events']) {
      const row = database.prepare(`
        SELECT
          count(*) AS total,
          sum(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS active,
          sum(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived
        FROM ${table}
      `).get();
      counts[table] = Object.fromEntries(
        Object.entries(row).map(([name, value]) => [name, Number(value || 0)])
      );
    }
    const scopeChecks = {
      customerContacts: `
        SELECT count(*) AS count FROM customer_contacts AS item
        LEFT JOIN customers AS parent ON parent.id = item.customer_id
        WHERE parent.id IS NULL OR parent.organization_id <> item.organization_id
      `,
      customerProfiles: `
        SELECT count(*) AS count FROM customer_profiles AS item
        LEFT JOIN customers AS parent ON parent.id = item.customer_id
        WHERE parent.id IS NULL OR parent.organization_id <> item.organization_id
      `,
      customerRelationships: `
        SELECT count(*) AS count FROM customer_relationships AS item
        LEFT JOIN customers AS parent ON parent.id = item.customer_id
        WHERE parent.id IS NULL OR parent.organization_id <> item.organization_id
      `,
      policyCoverages: `
        SELECT count(*) AS count FROM policy_coverages AS item
        LEFT JOIN policies AS parent ON parent.id = item.policy_id
        WHERE parent.id IS NULL OR parent.organization_id <> item.organization_id
      `,
      policyParties: `
        SELECT count(*) AS count FROM policy_parties AS item
        LEFT JOIN policies AS parent ON parent.id = item.policy_id
        WHERE parent.id IS NULL OR parent.organization_id <> item.organization_id
      `
    };
    const scopeViolations = Object.fromEntries(
      Object.entries(scopeChecks).map(([name, sql]) => [
        name,
        Number(database.prepare(sql).get()?.count || 0)
      ])
    );
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));
    return {
      counts,
      engine: 'sqlite',
      missingTables,
      schemaReady: missingTables.length === 0,
      scopeViolations
    };
  }

  function dataProtectionStatus() {
    const values = [
      ...statements.allCustomersForProtection.all().flatMap((row) => [
        row.name, row.phone, row.email, row.birthday, row.needs, row.note
      ]),
      ...statements.allPoliciesForProtection.all().flatMap((row) => [
        row.customer_name, row.policy_number, row.start_date, row.coverage,
        row.premium, row.summary
      ]),
      ...statements.allEventsForProtection.all().flatMap((row) => [
        row.title, row.detail, row.note
      ]),
      ...database.prepare('SELECT original_name FROM attachments').all()
        .map((row) => row.original_name),
      ...database.prepare(`
        SELECT occupation_ciphertext, household_summary_ciphertext, risk_notes_ciphertext
        FROM customer_profiles
      `).all().flatMap(Object.values),
      ...database.prepare('SELECT value_ciphertext FROM customer_contacts').all()
        .flatMap(Object.values),
      ...database.prepare(`
        SELECT display_name_ciphertext, note_ciphertext FROM customer_relationships
      `).all().flatMap(Object.values),
      ...database.prepare(`
        SELECT insured_amount_ciphertext, benefit_summary_ciphertext FROM policy_coverages
      `).all().flatMap(Object.values),
      ...database.prepare('SELECT display_name_ciphertext FROM policy_parties').all()
        .flatMap(Object.values),
      ...database.prepare(`
        SELECT subject_ciphertext, summary_ciphertext FROM customer_interactions
      `).all().flatMap(Object.values),
      ...database.prepare('SELECT title_ciphertext, detail_ciphertext FROM tasks').all()
        .flatMap(Object.values),
      ...database.prepare(`
        SELECT title_ciphertext, extracted_data_ciphertext FROM documents
      `).all().flatMap(Object.values),
      ...database.prepare('SELECT note_ciphertext FROM consents').all()
        .flatMap(Object.values),
      ...database.prepare('SELECT display_ciphertext FROM search_tokens').all()
        .flatMap(Object.values),
      ...database.prepare(`
        SELECT file_name_ciphertext, rows_ciphertext, error_csv_ciphertext FROM import_jobs
      `).all().flatMap(Object.values),
      ...database.prepare('SELECT value_ciphertext FROM ocr_fields').all()
        .flatMap(Object.values),
      ...database.prepare(`
        SELECT previous_value_ciphertext, corrected_value_ciphertext FROM ocr_corrections
      `).all().flatMap(Object.values)
    ];
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

  function exportPostgresqlSnapshot() {
    database.exec('BEGIN');
    try {
      const scopedTables = ['customers', 'policies', 'events', 'team_members', 'team_tasks'];
      for (const table of scopedTables) {
        const unscoped = database.prepare(
          `SELECT COUNT(*) AS count FROM ${table} WHERE organization_id IS NULL`
        ).get();
        if (Number(unscoped?.count || 0) > 0) {
          throw new Error(`UNSCOPED_LEGACY_DATA:${table}`);
        }
      }
      const auditUnscoped = database.prepare(
        'SELECT COUNT(*) AS count FROM audit_logs WHERE organization_id IS NULL'
      ).get();
      if (Number(auditUnscoped?.count || 0) > 0) {
        throw new Error('UNSCOPED_LEGACY_DATA:audit_logs');
      }

      const snapshot = {
        format: 'sasha-postgresql-migration-v1',
        exportedAt: new Date().toISOString(),
        appRevision: getRevision(),
        organizations: database.prepare('SELECT * FROM organizations ORDER BY created_at, id').all(),
        users: database.prepare('SELECT * FROM users ORDER BY created_at, id').all(),
        recoveryCodes: database.prepare(
          'SELECT * FROM user_recovery_codes ORDER BY id'
        ).all(),
        customers: database.prepare(
          'SELECT * FROM customers ORDER BY organization_id, id'
        ).all(),
        policies: database.prepare(
          'SELECT * FROM policies ORDER BY organization_id, id'
        ).all(),
        events: database.prepare(
          'SELECT * FROM events ORDER BY organization_id, id'
        ).all(),
        teamMembers: database.prepare(
          'SELECT * FROM team_members ORDER BY organization_id, id'
        ).all(),
        teamTasks: database.prepare(
          'SELECT * FROM team_tasks ORDER BY organization_id, id'
        ).all(),
        organizationSettings: database.prepare(
          'SELECT * FROM organization_settings ORDER BY organization_id, key'
        ).all(),
        organizationRevisions: database.prepare(
          'SELECT * FROM organization_revisions ORDER BY organization_id'
        ).all(),
        auditLogs: database.prepare(
          'SELECT * FROM audit_logs ORDER BY id'
        ).all(),
        attachments: database.prepare(
          'SELECT * FROM attachments ORDER BY organization_id, created_at, id'
        ).all()
      };
      snapshot.counts = {
        organizations: snapshot.organizations.length,
        users: snapshot.users.length,
        recoveryCodes: snapshot.recoveryCodes.length,
        customers: snapshot.customers.length,
        policies: snapshot.policies.length,
        events: snapshot.events.length,
        teamMembers: snapshot.teamMembers.length,
        teamTasks: snapshot.teamTasks.length,
        organizationSettings: snapshot.organizationSettings.length,
        organizationRevisions: snapshot.organizationRevisions.length,
        auditLogs: snapshot.auditLogs.length,
        attachments: snapshot.attachments.length
      };
      database.exec('COMMIT');
      return snapshot;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function backupTo(destination) {
    mkdirSync(dirname(destination), { recursive: true });
    const escapedDestination = String(destination).replaceAll("'", "''");
    database.exec('PRAGMA wal_checkpoint(FULL)');
    database.exec(`VACUUM INTO '${escapedDestination}'`);
    return destination;
  }

  function countUsers() {
    return Number(statements.countUsers.get()?.count || 0);
  }

  function createOrganizationOwner(input) {
    database.exec('BEGIN IMMEDIATE');
    try {
      if (countUsers() > 0) throw new Error('SETUP_ALREADY_COMPLETED');
      const now = new Date().toISOString();
      statements.insertOrganization.run(
        toText(input.organizationId),
        toText(input.organizationName),
        now
      );
      statements.insertUser.run(
        toText(input.userId),
        toText(input.organizationId),
        toText(input.displayName),
        toText(input.username).toLowerCase(),
        toText(input.passwordHash),
        toText(input.passwordSalt),
        'owner',
        now,
        now
      );
      const legacyRevision = getRevision();
      statements.createOrganizationRevision.run(toText(input.organizationId), legacyRevision);
      unprotectLegacyUnscopedData();
      statements.claimLegacyCustomers.run(toText(input.organizationId));
      statements.claimLegacyPolicies.run(toText(input.organizationId));
      statements.claimLegacyEvents.run(toText(input.organizationId));
      statements.claimLegacyMembers.run(toText(input.organizationId));
      statements.claimLegacyTasks.run(toText(input.organizationId));
      statements.claimLegacyAudit.run(toText(input.organizationId));
      backfillCustomerOwnerUserIds(input.organizationId);
      const legacyGoal = statements.teamGoal.get()?.value;
      if (legacyGoal !== undefined) {
        statements.setOrganizationTeamGoal.run(toText(input.organizationId), toText(legacyGoal));
      }
      protectSensitiveDataRows();
      recordOrganizationAudit(
        input.organizationId,
        input.userId,
        'setup',
        'organization',
        input.organizationId,
        { ownerUserId: input.userId }
      );
      database.exec('COMMIT');
      return { user: getUserById(input.userId) };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function getUserById(id) {
    return rowToUser(statements.userById.get(toText(id)));
  }

  function getUserByUsername(username) {
    return rowToUser(statements.userByUsername.get(toText(username).toLowerCase()));
  }

  function createOrganization(input) {
    const now = new Date().toISOString();
    statements.insertOrganization.run(toText(input.id), toText(input.name), now);
    statements.createOrganizationRevision.run(toText(input.id), 0);
    return { id: toText(input.id), name: toText(input.name), createdAt: now };
  }

  function listOrganizationUsers(organizationId) {
    return statements.organizationUsers.all(toText(organizationId)).map(publicUser);
  }

  function getOrganizationUser(organizationId, userId) {
    return publicUser(statements.organizationUserById.get(
      toText(organizationId),
      toText(userId)
    ));
  }

  function createOrganizationUser(organizationId, actorUserId, input) {
    const organization = toText(organizationId);
    const now = new Date().toISOString();
    statements.insertUser.run(
      toText(input.id),
      organization,
      toText(input.displayName),
      toText(input.username).toLowerCase(),
      toText(input.passwordHash),
      toText(input.passwordSalt),
      toText(input.role || 'advisor'),
      now,
      now
    );
    recordOrganizationAudit(
      organization,
      actorUserId,
      'create',
      'user',
      input.id,
      { role: toText(input.role || 'advisor') }
    );
    return getOrganizationUser(organization, input.id);
  }

  function updateOrganizationUser(organizationId, actorUserId, userId, input) {
    const organization = toText(organizationId);
    const current = getOrganizationUser(organization, userId);
    if (!current) return { notFound: true };
    if (current.role === 'owner') return { protectedOwner: true };
    const result = statements.updateOrganizationUser.run(
      toText(input.displayName || current.displayName),
      toText(input.role || current.role),
      input.active === false ? 0 : 1,
      new Date().toISOString(),
      organization,
      toText(userId)
    );
    if (!result.changes) return { notFound: true };
    statements.renameOrganizationCustomerOwner.run(
      toText(input.displayName || current.displayName),
      organization,
      toText(userId)
    );
    if (input.active === false || input.role !== current.role) {
      statements.deleteUserSessions.run(toText(userId));
    }
    recordOrganizationAudit(
      organization,
      actorUserId,
      'update',
      'user',
      userId,
      { role: toText(input.role || current.role), active: input.active !== false }
    );
    return { item: getOrganizationUser(organization, userId) };
  }

  function resetOrganizationUserPassword(
    organizationId,
    actorUserId,
    userId,
    passwordHash,
    passwordSalt
  ) {
    const organization = toText(organizationId);
    const current = getOrganizationUser(organization, userId);
    if (!current) return { notFound: true };
    const result = statements.resetOrganizationUserPassword.run(
      toText(passwordHash),
      toText(passwordSalt),
      new Date().toISOString(),
      organization,
      toText(userId)
    );
    if (!result.changes) return { notFound: true };
    statements.deleteUserSessions.run(toText(userId));
    recordOrganizationAudit(
      organization,
      actorUserId,
      'reset_password',
      'user',
      userId,
      {}
    );
    return { item: getOrganizationUser(organization, userId) };
  }

  function changeOrganizationUserPassword(
    organizationId,
    userId,
    passwordHash,
    passwordSalt
  ) {
    const organization = toText(organizationId);
    const current = getOrganizationUser(organization, userId);
    if (!current) return { notFound: true };
    const result = statements.resetOrganizationUserPassword.run(
      toText(passwordHash),
      toText(passwordSalt),
      new Date().toISOString(),
      organization,
      toText(userId)
    );
    if (!result.changes) return { notFound: true };
    statements.deleteUserSessions.run(toText(userId));
    recordOrganizationAudit(
      organization,
      userId,
      'change_password',
      'user',
      userId,
      {}
    );
    return { item: getOrganizationUser(organization, userId) };
  }

  function recoverOrganizationUser(
    organizationId,
    userId,
    passwordHash,
    passwordSalt,
    { disableMfa = false } = {}
  ) {
    const organization = toText(organizationId);
    database.exec('BEGIN IMMEDIATE');
    try {
      const current = getOrganizationUser(organization, userId);
      if (!current || !current.active) {
        database.exec('ROLLBACK');
        return { notFound: true };
      }
      const result = statements.resetOrganizationUserPassword.run(
        toText(passwordHash),
        toText(passwordSalt),
        new Date().toISOString(),
        organization,
        toText(userId)
      );
      if (!result.changes) {
        database.exec('ROLLBACK');
        return { notFound: true };
      }
      if (disableMfa) {
        statements.disableUserMfa.run(
          new Date().toISOString(),
          organization,
          toText(userId)
        );
        statements.deleteRecoveryCodes.run(toText(userId));
      }
      statements.deleteUserSessions.run(toText(userId));
      recordOrganizationAudit(
        organization,
        userId,
        'emergency_recovery',
        'user',
        userId,
        { mfaDisabled: Boolean(disableMfa) }
      );
      database.exec('COMMIT');
      return { item: getOrganizationUser(organization, userId) };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function setOrganizationUserMfaPending(
    organizationId,
    userId,
    encryptedSecret,
    recoveryCodeHashes
  ) {
    const organization = toText(organizationId);
    database.exec('BEGIN IMMEDIATE');
    try {
      const now = new Date().toISOString();
      const result = statements.setUserMfaSecret.run(
        toText(encryptedSecret),
        now,
        organization,
        toText(userId)
      );
      if (!result.changes) {
        database.exec('ROLLBACK');
        return { notFound: true };
      }
      statements.deleteRecoveryCodes.run(toText(userId));
      for (const codeHash of recoveryCodeHashes) {
        statements.insertRecoveryCode.run(toText(userId), toText(codeHash), now);
      }
      recordOrganizationAudit(
        organization,
        userId,
        'mfa_setup_started',
        'user',
        userId,
        { recoveryCodeCount: recoveryCodeHashes.length }
      );
      database.exec('COMMIT');
      return { item: getOrganizationUser(organization, userId) };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function enableOrganizationUserMfa(organizationId, userId, counter) {
    const organization = toText(organizationId);
    const result = statements.enableUserMfa.run(
      Number(counter),
      new Date().toISOString(),
      organization,
      toText(userId)
    );
    if (!result.changes) return { notFound: true };
    recordOrganizationAudit(organization, userId, 'mfa_enabled', 'user', userId, {});
    return { item: getOrganizationUser(organization, userId) };
  }

  function disableOrganizationUserMfa(organizationId, userId) {
    const organization = toText(organizationId);
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = statements.disableUserMfa.run(
        new Date().toISOString(),
        organization,
        toText(userId)
      );
      if (!result.changes) {
        database.exec('ROLLBACK');
        return { notFound: true };
      }
      statements.deleteRecoveryCodes.run(toText(userId));
      statements.deleteUserSessions.run(toText(userId));
      recordOrganizationAudit(organization, userId, 'mfa_disabled', 'user', userId, {});
      database.exec('COMMIT');
      return { item: getOrganizationUser(organization, userId) };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function consumeUserTotpCounter(userId, counter) {
    const result = statements.consumeUserTotpCounter.run(
      Number(counter),
      new Date().toISOString(),
      toText(userId),
      Number(counter)
    );
    return Boolean(result.changes);
  }

  function consumeUserRecoveryCode(userId, codeHash) {
    const result = statements.consumeRecoveryCode.run(
      new Date().toISOString(),
      toText(userId),
      toText(codeHash)
    );
    return Boolean(result.changes);
  }

  function createSession(session) {
    statements.insertSession.run(
      toText(session.tokenHash),
      toText(session.userId),
      toText(session.csrfToken),
      toText(session.createdAt),
      toText(session.lastSeenAt),
      toText(session.expiresAt)
    );
  }

  function getSession(hash) {
    const row = statements.sessionByHash.get(toText(hash));
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      csrfToken: row.csrf_token,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
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

  function touchSession(hash, timestamp) {
    statements.touchSession.run(toText(timestamp), toText(hash));
  }

  function deleteSession(hash) {
    statements.deleteSession.run(toText(hash));
  }

  function deleteExpiredSessions(timestamp) {
    statements.deleteExpiredSessions.run(toText(timestamp));
  }

  function recordLoginFailure(userId, failures, lockedUntil) {
    statements.loginFailure.run(
      Number(failures || 0),
      nullableText(lockedUntil),
      new Date().toISOString(),
      toText(userId)
    );
  }

  function recordLoginSuccess(userId, timestamp) {
    statements.loginSuccess.run(toText(timestamp), new Date().toISOString(), toText(userId));
    const user = getUserById(userId);
    if (user) {
      recordOrganizationAudit(user.organizationId, user.id, 'login', 'user', user.id, {});
    }
  }

  const workflowRepository = createWorkflowRepository({
    engine: 'sqlite',
    driver: database,
    dataProtection,
    mutate: runOrganizationAsyncMutation,
    audit: (
      executor,
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata
    ) => recordOrganizationAudit(
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata
    ),
    getCustomer: (organizationId, id, accessUserId) =>
      getOrganizationCustomer(organizationId, id, accessUserId),
    getPolicy: (organizationId, id, accessUserId) =>
      getOrganizationPolicy(organizationId, id, accessUserId)
  });

  return {
    ...workflowRepository,
    backupTo,
    changeOrganizationUserPassword,
    close: () => database.close(),
    countUsers,
    dataProtectionStatus,
    createOrganization,
    createCustomer,
    createEvent,
    createOrganizationAttachment,
    createOrganizationCustomer,
    createOrganizationEvent,
    createOrganizationOwner,
    createOrganizationPolicy,
    createOrganizationUser,
    createPolicy,
    createSession,
    consumeUserRecoveryCode,
    consumeUserTotpCounter,
    deleteExpiredSessions,
    deleteSession,
    deleteCustomer,
    deleteEvent,
    deleteOrganizationCustomer,
    deleteOrganizationEvent,
    deleteOrganizationPolicy,
    disableOrganizationUserMfa,
    deletePolicy,
    filename,
    getCustomer,
    getEvent,
    getOrganizationAttachment,
    getOrganizationCustomer,
    getOrganizationEvent,
    getOrganizationPolicy,
    getOrganizationRevision,
    getOrganizationState,
    getOrganizationUser,
    getPolicy,
    getRevision,
    getSession,
    getState,
    getUserById,
    getUserByUsername,
    listCustomers,
    listAuditLogs,
    listEvents,
    listOrganizationAuditLogs,
    listAttachmentsForMaintenance,
    listOrganizationAttachments,
    listOrganizationCustomers,
    listOrganizationEvents,
    listOrganizationPolicies,
    listOrganizationResourcePage,
    listOrganizationUsers,
    listPolicies,
    phase2MigrationReport,
    protectSensitiveData,
    recordOrganizationApiAudit,
    recordLoginFailure,
    recordLoginSuccess,
    recoverOrganizationUser,
    enableOrganizationUserMfa,
    engine: 'sqlite',
    exportPostgresqlSnapshot,
    replaceOrganizationState,
    replaceOrganizationTeamState,
    resetOrganizationUserPassword,
    setOrganizationUserMfaPending,
    setOrganizationResourceArchived,
    updateCustomer,
    updateEvent,
    updateOrganizationCustomer,
    updateOrganizationEvent,
    updateOrganizationPolicy,
    updateOrganizationUser,
    updatePolicy,
    touchSession,
    verifyIntegrity,
    replaceState
  };
}
