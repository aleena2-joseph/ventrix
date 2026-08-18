-- =====================================================================
-- Phase 3 — RBAC + Multi-tenant foundation
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,   -- e.g. 'VENTRIX_ADMIN'
    description VARCHAR(200)
);

INSERT INTO roles (id, name, description) VALUES
    (1, 'SUPER_ADMIN',    'Full platform control'),
    (2, 'VENTRIX_ADMIN',  'Manages customers, products, assets, operations'),
    (3, 'ENGINEER',       'Monitoring, maintenance, technical analysis'),
    (4, 'TECHNICIAN',     'Executes work orders and maintenance'),
    (5, 'CUSTOMER_ADMIN', 'Manages their organization''s users and assets'),
    (6, 'CUSTOMER_USER',  'Views assets, monitoring, and service requests')
ON CONFLICT (id) DO NOTHING;
-- Keep the sequence ahead of our manually-numbered seed rows above.
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- ---------------------------------------------------------------------
-- ORGANIZATIONS
-- Every tenant is an organization — including Ventrix itself (type
-- MANUFACTURER), so "who am I" is always answered the same way:
-- users.organization_id -> organizations.id
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,   -- e.g. 'VTX', 'IR'
    name        VARCHAR(150) NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER', -- MANUFACTURER, CUSTOMER
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, INACTIVE
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (code, name, type, status) VALUES
    ('VTX', 'Ventrix', 'MANUFACTURER', 'ACTIVE'),
    ('IR', 'Indian Railways', 'CUSTOMER', 'ACTIVE'),
    ('MRC', 'Metro Rail Corporation', 'CUSTOMER', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;
