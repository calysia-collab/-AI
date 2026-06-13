-- Frozen initial PostgreSQL baseline. Never edit after release.
BEGIN;

CREATE TABLE IF NOT EXISTS app_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO app_meta (key, value)
VALUES ('revision', '0')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role text NOT NULL DEFAULT 'advisor'
    CHECK (role IN ('owner', 'manager', 'advisor', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  mfa_secret_ciphertext text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_last_counter bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users(lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS user_recovery_codes_user_id_idx
  ON user_recovery_codes(user_id, used_at);

CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  birthday date,
  owner_user_id text,
  owner text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT '新名單',
  next_follow_up date,
  needs text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, owner_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS customers_organization_id_idx ON customers(organization_id);
CREATE INDEX IF NOT EXISTS customers_owner_user_id_idx
  ON customers(organization_id, owner_user_id);

CREATE TABLE IF NOT EXISTS policies (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  company text NOT NULL,
  policy_number text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  start_date date,
  payment_years text NOT NULL DEFAULT '',
  coverage text NOT NULL DEFAULT '',
  premium text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  updated_label text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS policies_organization_id_idx ON policies(organization_id);
CREATE INDEX IF NOT EXISTS policies_customer_id_idx ON policies(customer_id);
CREATE INDEX IF NOT EXISTS policies_policy_number_idx ON policies(policy_number);

CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id text,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time time NOT NULL,
  category text NOT NULL,
  reminder text NOT NULL DEFAULT '15 分鐘前',
  detail text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled',
  CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS events_organization_id_idx ON events(organization_id);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_customer_id_idx ON events(customer_id);

CREATE TABLE IF NOT EXISTS team_members (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  target integer NOT NULL DEFAULT 0 CHECK (target >= 0),
  closed integer NOT NULL DEFAULT 0 CHECK (closed >= 0),
  is_owner boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS team_members_organization_id_idx ON team_members(organization_id);

CREATE TABLE IF NOT EXISTS team_tasks (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  owner text NOT NULL DEFAULT '',
  due text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS team_tasks_organization_id_idx ON team_tasks(organization_id);

CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (organization_id, key)
);

CREATE TABLE IF NOT EXISTS organization_revisions (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_organization_id_idx
  ON audit_logs(organization_id, created_at DESC);

COMMIT;
