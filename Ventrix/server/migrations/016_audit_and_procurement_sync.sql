-- Migration 016: Audit Logs, Alert-WorkOrder Linking, and Enhanced Lifecycle Tracking

-- 1. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 2. Link Work Orders to Alerts and Service Requests (if columns do not already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'alert_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'service_request_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'priority'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM';
  END IF;
END $$;

-- 3. Ensure permissions table has audit and extended operational permissions
INSERT INTO permissions (permission_key, label, category, description) VALUES
  ('audit.view', 'View audit logs', 'Administration', 'View comprehensive system audit trail'),
  ('inventory.view', 'View inventory', 'Operations', 'View spare parts stock and transactions')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant audit permissions to Super Admin and Ventrix Admin
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN permissions p ON p.permission_key IN ('audit.view', 'inventory.view')
WHERE r.name IN ('SUPER_ADMIN', 'VENTRIX_ADMIN')
ON CONFLICT DO NOTHING;

-- Grant inventory.view to Engineer and Technician
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'inventory.view'
FROM roles r
WHERE r.name IN ('ENGINEER', 'TECHNICIAN')
ON CONFLICT DO NOTHING;
