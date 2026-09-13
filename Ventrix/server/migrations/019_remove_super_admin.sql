-- =====================================================================
-- Migration 019 — Remove SUPER_ADMIN role and superadmin@ventrix.com user
-- =====================================================================

-- 1. Delete user superadmin@ventrix.com
DELETE FROM users WHERE email = 'superadmin@ventrix.com';

-- 2. Delete role_permissions associated with SUPER_ADMIN
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = 'SUPER_ADMIN');

-- 3. Delete SUPER_ADMIN role
DELETE FROM roles WHERE name = 'SUPER_ADMIN';
