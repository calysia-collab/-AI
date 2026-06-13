BEGIN;

ALTER TABLE customers
  ALTER COLUMN birthday TYPE text USING birthday::text;

ALTER TABLE policies
  ALTER COLUMN start_date TYPE text USING start_date::text;

CREATE UNIQUE INDEX IF NOT EXISTS policies_organization_id_id_idx
  ON policies(organization_id, id);

CREATE TABLE IF NOT EXISTS attachments (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by text NOT NULL,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  policy_id text REFERENCES policies(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('clean', 'quarantined', 'infected')),
  storage_key text NOT NULL,
  scan_detail text NOT NULL DEFAULT '',
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, uploaded_by)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION enforce_attachment_organization_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM customers
    WHERE id = NEW.customer_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'ATTACHMENT_CUSTOMER_SCOPE_INVALID';
  END IF;
  IF NEW.policy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM policies
    WHERE id = NEW.policy_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'ATTACHMENT_POLICY_SCOPE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attachments_organization_scope_guard ON attachments;
CREATE TRIGGER attachments_organization_scope_guard
BEFORE INSERT OR UPDATE OF organization_id, customer_id, policy_id ON attachments
FOR EACH ROW EXECUTE FUNCTION enforce_attachment_organization_scope();

CREATE INDEX IF NOT EXISTS attachments_organization_id_idx
  ON attachments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attachments_customer_id_idx
  ON attachments(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS attachments_policy_id_idx
  ON attachments(organization_id, policy_id);

COMMIT;
