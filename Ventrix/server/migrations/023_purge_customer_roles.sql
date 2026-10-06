-- =====================================================================
-- Migration 023: Purge Multitenancy & Customer Roles
-- Ventrix is a single-tier railway HVAC monitoring & RUL platform.
-- Strictly enforce the 3 railway operational roles:
--   1. ADMIN
--   2. ENGINEER
--   3. TECHNICIAN
-- =====================================================================

-- 1. Remove obsolete customer and super_admin role permissions
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER', 'SUPER_ADMIN')
);

-- 2. Remove obsolete customers.manage permission from role_permissions and permissions
DELETE FROM role_permissions WHERE permission_key = 'customers.manage';
DELETE FROM permissions WHERE permission_key = 'customers.manage';

-- 3. Reassign any accidental users to TECHNICIAN before deleting customer roles
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'TECHNICIAN' LIMIT 1)
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER', 'SUPER_ADMIN'));

-- 4. Delete customer roles and super_admin from roles table
DELETE FROM roles WHERE name IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER', 'SUPER_ADMIN');

-- 5. Standardize descriptions for the 3 Railway Roles
UPDATE roles
SET description = 'Fleet-wide operational visibility, railway asset registry, user governance, and depot management.'
WHERE name = 'ADMIN';

UPDATE roles
SET description = 'Detailed HVAC diagnostics, physics & AI RUL analysis, maintenance planning, and work order verification.'
WHERE name = 'ENGINEER';

UPDATE roles
SET description = 'Field maintenance execution, task-oriented inspection tools, spare-parts requisitions, and service logging.'
WHERE name = 'TECHNICIAN';

-- 6. Ensure default railway permissions matrix for the 3 roles
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'dashboard.view', 'assets.view', 'fleet.view', 'telemetry.view',
  'predictions.view', 'alerts.view', 'maintenance.view', 'maintenance.manage',
  'maintenance.verify', 'service_requests.view', 'service_requests.create',
  'parts.request', 'parts.issue', 'inventory.manage', 'products.manage', 'reports.view'
)
WHERE r.name = 'ENGINEER'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'dashboard.view', 'assets.view', 'telemetry.view', 'predictions.view',
  'alerts.view', 'maintenance.view', 'maintenance.manage', 'service_requests.view',
  'service_requests.create', 'parts.request', 'reports.view'
)
WHERE r.name = 'TECHNICIAN'
ON CONFLICT DO NOTHING;
