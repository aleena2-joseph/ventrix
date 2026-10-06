-- =====================================================================
-- Locations and Depots Management
-- Allows centralized definition of railway depots, coaching yards,
-- workshops, and coach zones. Only administrators can add or manage
-- locations; engineers and technicians select from the predefined list.
-- =====================================================================

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50),
    type VARCHAR(50) DEFAULT 'DEPOT', -- 'DEPOT', 'COACH', 'YARD', 'WORKSHOP', 'STATION'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO permissions (permission_key, label, category, description) VALUES
  ('locations.manage', 'Manage Locations & Depots', 'Administration', 'Create and configure railway depot, yard, and coach locations')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, 'locations.manage'
FROM roles r
WHERE r.name IN ('ADMIN', 'VENTRIX_ADMIN', 'SUPER_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO locations (name, code, type, description) VALUES
  ('Coach A1', 'LOC-A1', 'COACH', 'Air-Conditioned First Class (1A) Coach'),
  ('Coach A2', 'LOC-A2', 'COACH', 'Air-Conditioned First Class (1A) Coach'),
  ('Coach B4', 'LOC-B4', 'COACH', 'AC Two-Tier (2A) Coach'),
  ('Coach D1', 'LOC-D1', 'COACH', 'AC Three-Tier (3A) Coach'),
  ('Coach D2', 'LOC-D2', 'COACH', 'AC Three-Tier (3A) Coach'),
  ('New Delhi Depot', 'DEPOT-NDLS', 'DEPOT', 'Northern Railway Central Mechanical Maintenance Depot'),
  ('Mumbai Central Coaching Yard', 'YARD-MMCT', 'YARD', 'Western Railway AC Coaching Depot & Yard'),
  ('Howrah Maintenance Shed', 'SHED-HWH', 'WORKSHOP', 'Eastern Railway HVAC Maintenance Shed'),
  ('Chennai Central Depot', 'DEPOT-MAS', 'DEPOT', 'Southern Railway Carriage & Wagon Depot'),
  ('Secunderabad Electric Shed', 'SHED-SC', 'WORKSHOP', 'South Central Railway Electrical Multiple Unit Shed')
ON CONFLICT (name) DO NOTHING;
