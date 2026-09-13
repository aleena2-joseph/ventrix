-- =====================================================================
-- Phase 6 — Fix Technician Permissions
-- Technicians CANNOT add, edit, or adjust warehouse inventory stock.
-- They can view stock and request spare parts, requiring Admin/Engineer approval.
-- =====================================================================

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name = 'TECHNICIAN')
  AND permission_key IN ('inventory.manage', 'service_requests.view', 'service_requests.create', 'service_requests.manage');

-- Ensure inventory.view is present for Technician
INSERT INTO permissions (permission_key, label, category, description)
VALUES ('inventory.view', 'View inventory', 'Operations', 'View warehouse spare parts catalog')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'inventory.view'
FROM roles r
WHERE r.name = 'TECHNICIAN'
ON CONFLICT DO NOTHING;
