-- Phase 3: OCR processing, confidence review, correction audit and approval.
BEGIN;

CREATE TABLE IF NOT EXISTS ocr_jobs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attachment_id text NOT NULL REFERENCES attachments(id) ON DELETE RESTRICT,
  customer_id text NOT NULL,
  document_id text,
  policy_id text,
  provider text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('queued', 'processing', 'review_required', 'approved', 'failed', 'cancelled')),
  error_code text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, document_id)
    REFERENCES documents(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, policy_id)
    REFERENCES policies(organization_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id, reviewed_by)
    REFERENCES users(organization_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ocr_jobs_organization_idx
  ON ocr_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ocr_jobs_customer_idx
  ON ocr_jobs(organization_id, customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ocr_fields (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ocr_job_id text NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  value_ciphertext text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  corrected boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ocr_job_id, field_name)
);

CREATE TABLE IF NOT EXISTS ocr_corrections (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ocr_job_id text NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  ocr_field_id text NOT NULL REFERENCES ocr_fields(id) ON DELETE CASCADE,
  corrected_by text NOT NULL,
  previous_value_ciphertext text NOT NULL,
  corrected_value_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, corrected_by)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ocr_corrections_job_idx
  ON ocr_corrections(organization_id, ocr_job_id, created_at);

COMMIT;
