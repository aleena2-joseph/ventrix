-- =====================================================================
-- Migration 021 — Railway Maintenance Workflow & Role Realignment
-- 1. Adds maintenance_type, acceptance, completion reporting, and engineering verification to work_orders
-- 2. Separates part approval from physical stock issuance in part_requests
-- 3. Adds user_id and reason to stock_transactions for auditable inventory
-- 4. Separates alert acknowledgement from resolution
-- 5. Adds estimated duration, templates, and required parts to maintenance_schedules
-- 6. Cleans up role permission matrix to focus strictly on railway operations
-- =====================================================================

-- 1. WORK ORDERS ENHANCEMENTS
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS maintenance_type VARCHAR(20) NOT NULL DEFAULT 'CORRECTIVE',
  ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(50) DEFAULT '1 hour',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_report JSONB,
  ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS findings TEXT;

-- Index for status filtering and duplicate checks
CREATE INDEX IF NOT EXISTS idx_work_orders_asset_status ON work_orders (asset_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_maint_type ON work_orders (maintenance_type);

-- 2. PART REQUESTS ENHANCEMENTS
-- Add issuance and usage tracking columns
ALTER TABLE part_requests
  ADD COLUMN IF NOT EXISTS issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- 3. STOCK TRANSACTIONS ENHANCEMENTS
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- 4. ALERTS ENHANCEMENTS
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts (is_acknowledged);

-- 5. MAINTENANCE SCHEDULES ENHANCEMENTS
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(50) DEFAULT '1 hour',
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS required_parts TEXT;

-- 6. PERMISSIONS CLEANUP
-- Remove non-railway SaaS permissions
DELETE FROM role_permissions WHERE permission_key IN ('customers.manage', 'products.manage');
DELETE FROM permissions WHERE permission_key IN ('customers.manage', 'products.manage');

-- Add new specific railway operations permissions
INSERT INTO permissions (permission_key, label, category, description) VALUES
  ('maintenance.verify', 'Verify & close maintenance', 'Operations', 'Inspect and sign off completed work orders'),
  ('parts.request',      'Request spare parts',        'Operations', 'Submit spare part requisitions for work orders'),
  ('parts.issue',        'Issue warehouse stock',      'Operations', 'Physically issue approved spare parts from warehouse')
ON CONFLICT (permission_key) DO NOTHING;

-- Assign permissions to roles
-- Admin: gets full system & inventory oversight
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
CROSS JOIN (
  VALUES ('maintenance.verify'), ('parts.issue')
) p(permission_key)
WHERE r.name IN ('VENTRIX_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

-- Engineer: primary maintenance controller, approves and verifies
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
CROSS JOIN (
  VALUES ('maintenance.verify'), ('parts.request')
) p(permission_key)
WHERE r.name = 'ENGINEER'
ON CONFLICT DO NOTHING;

-- Technician: field execution, requests parts
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
CROSS JOIN (
  VALUES ('parts.request')
) p(permission_key)
WHERE r.name = 'TECHNICIAN'
ON CONFLICT DO NOTHING;
