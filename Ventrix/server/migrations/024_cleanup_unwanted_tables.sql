-- =====================================================================
-- Migration 024: Remove Unwanted Tables & Enforce Single Railway Architecture
-- Drops legacy e-commerce / ERP procurement tables:
--   - payments
--   - purchase_order_items
--   - purchase_orders
--   - suppliers
-- Cleans up obsolete permissions (customers.manage, procurement.manage)
-- Unifies organizations into a single Indian Railways authority.
-- =====================================================================

-- 1. Drop unwanted legacy procurement and e-commerce tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- 2. Remove obsolete permissions from role_permissions and permissions
DELETE FROM role_permissions WHERE permission_key IN ('customers.manage', 'procurement.manage');
DELETE FROM permissions WHERE permission_key IN ('customers.manage', 'procurement.manage');

-- 3. Consolidate organizations into single Indian Railways authority (ID 1)
UPDATE users SET organization_id = 1 WHERE organization_id IS NOT NULL;
UPDATE projects SET organization_id = 1 WHERE organization_id IS NOT NULL;
UPDATE service_requests SET organization_id = 1 WHERE organization_id IS NOT NULL;
UPDATE audit_logs SET organization_id = 1 WHERE organization_id IS NOT NULL;

DELETE FROM organizations WHERE id != 1;

UPDATE organizations
SET code = 'IR', name = 'Indian Railways', type = 'RAILWAY_AUTHORITY', status = 'ACTIVE'
WHERE id = 1;
