-- =====================================================================
-- Migration 026: Streamline Database Schema to Core Railway HVAC Scope
-- Removes unused enterprise multi-tenancy tables:
--   - organizations
--   - projects
--   - products
--   - locations
-- Drops foreign key columns:
--   - users.organization_id
--   - service_requests.organization_id
--   - audit_logs.organization_id
--   - trains.project_id
--   - assets.product_id
-- Cleans up obsolete permissions and locks roles to:
--   - ADMIN
--   - ENGINEER
--   - TECHNICIAN
-- =====================================================================

-- 1. Remove organization_id from tables
ALTER TABLE users DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE service_requests DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS organization_id CASCADE;

-- 2. Remove project_id from trains
ALTER TABLE trains DROP COLUMN IF EXISTS project_id CASCADE;

-- 3. Remove product_id from assets
ALTER TABLE assets DROP COLUMN IF EXISTS product_id CASCADE;

-- 4. Drop non-essential enterprise/multi-tenancy tables
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- 5. Remove obsolete permissions
DELETE FROM role_permissions WHERE permission_key IN (
  'locations.manage', 'products.manage', 'customers.manage', 'procurement.manage'
);
DELETE FROM permissions WHERE permission_key IN (
  'locations.manage', 'products.manage', 'customers.manage', 'procurement.manage'
);

-- 6. Ensure strict 3-role model
DELETE FROM role_permissions WHERE role_id NOT IN (
  SELECT id FROM roles WHERE name IN ('ADMIN', 'ENGINEER', 'TECHNICIAN')
);
DELETE FROM roles WHERE name NOT IN ('ADMIN', 'ENGINEER', 'TECHNICIAN');
