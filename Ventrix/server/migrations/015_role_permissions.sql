-- =====================================================================
-- Role permission matrix. Super Admin is intentionally enforced as an
-- application-level safety override and cannot lose administrative access.
-- =====================================================================

CREATE TABLE IF NOT EXISTS permissions (
    permission_key VARCHAR(80) PRIMARY KEY,
    label          VARCHAR(120) NOT NULL,
    category       VARCHAR(50) NOT NULL,
    description    VARCHAR(250)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(80) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_key)
);

INSERT INTO permissions (permission_key, label, category, description) VALUES
  ('dashboard.view',          'View dashboard',       'Monitoring', 'View fleet overview and KPIs'),
  ('assets.view',             'View assets',          'Assets',     'View asset registry and details'),
  ('assets.manage',           'Manage assets',        'Assets',     'Create, edit, and update asset status'),
  ('fleet.view',              'View fleet structure', 'Assets',     'View projects, trains, and coaches'),
  ('fleet.manage',            'Manage fleet structure','Assets',    'Create projects, trains, and coaches'),
  ('telemetry.view',          'View telemetry',       'Monitoring', 'View live and historical telemetry'),
  ('predictions.view',        'View predictions',     'Monitoring', 'View RUL and health predictions'),
  ('alerts.view',             'View alerts',          'Monitoring', 'View active alerts'),
  ('alerts.manage',           'Manage alerts',        'Monitoring', 'Create and resolve alerts'),
  ('maintenance.view',        'View maintenance',     'Operations', 'View schedules and work orders'),
  ('maintenance.manage',      'Manage maintenance',   'Operations', 'Create and update maintenance work'),
  ('service_requests.view',   'View service requests','Operations', 'View submitted service requests'),
  ('service_requests.create', 'Create service requests','Operations','Submit service requests'),
  ('service_requests.manage', 'Manage service requests','Operations','Triage and resolve service requests'),
  ('inventory.manage',        'Manage inventory',     'Operations', 'Manage parts and stock'),
  ('procurement.manage',      'Manage procurement',   'Operations', 'Manage suppliers and purchase orders'),
  ('products.manage',         'Manage products',      'Administration', 'Manage product catalogue'),
  ('customers.manage',        'Manage customers',     'Administration', 'Manage customer organizations'),
  ('users.manage',            'Manage users',         'Administration', 'Create, activate, and deactivate users'),
  ('settings.manage',         'Manage permission matrix','Administration', 'Configure role permissions'),
  ('reports.view',            'View fleet reports',   'Monitoring', 'View and export fleet health and audit reports')
ON CONFLICT (permission_key) DO NOTHING;

-- Seed permissions equivalent to the existing role-based behaviour.
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN permissions p ON (
  r.name = 'SUPER_ADMIN'
  OR (r.name = 'VENTRIX_ADMIN' AND p.permission_key IN (
    'dashboard.view','assets.view','assets.manage','fleet.view','fleet.manage',
    'telemetry.view','predictions.view','alerts.view','alerts.manage',
    'maintenance.view','maintenance.manage','service_requests.view','service_requests.create','service_requests.manage',
    'inventory.manage','procurement.manage','products.manage','customers.manage','users.manage','reports.view','settings.manage'
  ))
  OR (r.name = 'ENGINEER' AND p.permission_key IN (
    'dashboard.view','assets.view','fleet.view','telemetry.view','predictions.view','alerts.view',
    'maintenance.view','maintenance.manage','service_requests.view','service_requests.create',
    'inventory.manage','products.manage','reports.view'
  ))
  OR (r.name = 'TECHNICIAN' AND p.permission_key IN (
    'dashboard.view','assets.view','telemetry.view','predictions.view','alerts.view',
    'maintenance.view','maintenance.manage','service_requests.view','service_requests.create','inventory.manage','products.manage','reports.view'
  ))
  OR (r.name = 'CUSTOMER_ADMIN' AND p.permission_key IN (
    'dashboard.view','assets.view','fleet.view','fleet.manage','telemetry.view','predictions.view',
    'alerts.view','maintenance.view','service_requests.view','service_requests.create','users.manage','reports.view'
  ))
  OR (r.name = 'CUSTOMER_USER' AND p.permission_key IN (
    'dashboard.view','assets.view','fleet.view','telemetry.view','predictions.view',
    'alerts.view','maintenance.view','service_requests.view','service_requests.create','reports.view'
  ))
)
ON CONFLICT DO NOTHING;
