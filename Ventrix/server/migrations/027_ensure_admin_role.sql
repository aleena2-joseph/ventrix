-- Migration 027 — Ensure ADMIN role exists and assign to admin@ventrix.com

INSERT INTO roles (name, description)
VALUES ('ADMIN', 'Full system administrator with unrestricted access')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN')
WHERE email = 'admin@ventrix.com';

-- Seed default permissions to ADMIN
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;
