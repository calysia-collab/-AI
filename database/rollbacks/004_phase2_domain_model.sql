BEGIN;

DROP TABLE IF EXISTS consents;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS customer_interactions;
DROP TABLE IF EXISTS policy_parties;
DROP TABLE IF EXISTS policy_coverages;
DROP TABLE IF EXISTS customer_relationships;
DROP TABLE IF EXISTS customer_contacts;
DROP TABLE IF EXISTS customer_profiles;

DROP INDEX IF EXISTS events_active_page_idx;
DROP INDEX IF EXISTS policies_active_page_idx;
DROP INDEX IF EXISTS customers_active_owner_page_idx;
DROP INDEX IF EXISTS customers_active_page_idx;

ALTER TABLE team_tasks DROP COLUMN IF EXISTS archived_at;
ALTER TABLE team_tasks DROP COLUMN IF EXISTS updated_at;
ALTER TABLE team_tasks DROP COLUMN IF EXISTS created_at;
ALTER TABLE team_tasks DROP COLUMN IF EXISTS version;
ALTER TABLE team_members DROP COLUMN IF EXISTS archived_at;
ALTER TABLE team_members DROP COLUMN IF EXISTS updated_at;
ALTER TABLE team_members DROP COLUMN IF EXISTS created_at;
ALTER TABLE team_members DROP COLUMN IF EXISTS version;
ALTER TABLE events DROP COLUMN IF EXISTS archived_at;
ALTER TABLE policies DROP COLUMN IF EXISTS archived_at;
ALTER TABLE customers DROP COLUMN IF EXISTS archived_at;

COMMIT;
