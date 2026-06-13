BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_organization_id_id_idx
  ON users(organization_id, id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS owner_user_id text;

CREATE INDEX IF NOT EXISTS customers_owner_user_id_idx
  ON customers(organization_id, owner_user_id);

UPDATE customers AS customer
SET owner_user_id = (
  SELECT min(users.id)
  FROM users
  WHERE users.organization_id = customer.organization_id
    AND users.display_name = customer.owner
    AND users.active = true
    AND users.role <> 'viewer'
)
WHERE customer.owner_user_id IS NULL
  AND customer.owner <> ''
  AND (
    SELECT count(*)
    FROM users
    WHERE users.organization_id = customer.organization_id
      AND users.display_name = customer.owner
      AND users.active = true
      AND users.role <> 'viewer'
  ) = 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_owner_user_organization_fk'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_owner_user_organization_fk
      FOREIGN KEY (organization_id, owner_user_id)
      REFERENCES users(organization_id, id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

COMMIT;
