-- Phase 2 domain model and archive support. Never edit after release.
BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS archived_at timestamptz;

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
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  occupation_ciphertext text NOT NULL DEFAULT '',
  marital_status text NOT NULL DEFAULT '',
  household_summary_ciphertext text NOT NULL DEFAULT '',
  risk_notes_ciphertext text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, customer_id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email', 'address', 'other')),
  label text NOT NULL DEFAULT '',
  value_ciphertext text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_relationships (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  related_customer_id text,
  relationship_type text NOT NULL,
  display_name_ciphertext text NOT NULL DEFAULT '',
  note_ciphertext text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, related_customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS policy_coverages (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id text NOT NULL,
  coverage_type text NOT NULL,
  insured_amount_ciphertext text NOT NULL DEFAULT '',
  benefit_summary_ciphertext text NOT NULL DEFAULT '',
  waiting_period text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, policy_id)
    REFERENCES policies(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS policy_parties (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id text NOT NULL,
  customer_id text,
  party_type text NOT NULL CHECK (party_type IN ('applicant', 'insured', 'beneficiary', 'payor', 'other')),
  display_name_ciphertext text NOT NULL DEFAULT '',
  relationship_label text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, policy_id)
    REFERENCES policies(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS customer_interactions (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  advisor_user_id text,
  interaction_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  subject_ciphertext text NOT NULL DEFAULT '',
  summary_ciphertext text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, advisor_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text,
  assigned_user_id text,
  title_ciphertext text NOT NULL,
  detail_ciphertext text NOT NULL DEFAULT '',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, assigned_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text,
  policy_id text,
  attachment_id text REFERENCES attachments(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  title_ciphertext text NOT NULL DEFAULT '',
  extracted_data_ciphertext text NOT NULL DEFAULT '',
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, policy_id)
    REFERENCES policies(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS consents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  consent_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn', 'expired')),
  granted_at timestamptz,
  withdrawn_at timestamptz,
  expires_at timestamptz,
  evidence_document_id text,
  note_ciphertext text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, evidence_document_id)
    REFERENCES documents(organization_id, id) ON DELETE RESTRICT
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

COMMIT;
