-- Phase 2 follow-up: blind-index search and resumable import jobs.
BEGIN;

CREATE TABLE IF NOT EXISTS search_tokens (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('customer', 'policy')),
  entity_id text NOT NULL,
  customer_id text,
  display_ciphertext text NOT NULL,
  token_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, entity_type, entity_id, token_hash),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS search_tokens_lookup_idx
  ON search_tokens(organization_id, token_hash, entity_type);

CREATE TABLE IF NOT EXISTS import_jobs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by text NOT NULL,
  file_name_ciphertext text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv', 'xlsx')),
  status text NOT NULL
    CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_errors', 'cancelled', 'failed')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  processed_rows integer NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
  imported_rows integer NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  failed_rows integer NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  cancel_requested boolean NOT NULL DEFAULT false,
  rows_ciphertext text NOT NULL,
  error_csv_ciphertext text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  FOREIGN KEY (organization_id, uploaded_by)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS import_jobs_organization_idx
  ON import_jobs(organization_id, created_at DESC);

COMMIT;
