-- =====================================================================
-- Phase 3 — Attach users to roles + organizations
-- =====================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS role_id          INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Anyone who registered before roles/orgs existed becomes a Ventrix
-- admin by default so nobody is locked out after this migration —
-- reassign manually afterwards if that's wrong for a given user.
UPDATE users
SET
    organization_id = (SELECT id FROM organizations WHERE code = 'VTX'),
    role_id = (SELECT id FROM roles WHERE name = 'VENTRIX_ADMIN')
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id);
