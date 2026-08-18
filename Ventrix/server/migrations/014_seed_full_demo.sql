-- =====================================================================
-- Phase 4 — Full demo seed data
-- Demo password for every seeded user below is:  Ventrix@123
-- (bcrypt hash generated once with cost 10 — same hash reused for all
-- demo accounts purely for convenience; real users set their own via
-- POST /api/auth/register.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Users — one per role, split across Ventrix (manufacturer) and
-- Indian Railways (customer) organizations.
-- ---------------------------------------------------------------------
INSERT INTO users (name, email, password, organization_id, role_id, status)
SELECT v.name, v.email, '$2b$10$A5d7oQD2mQ.kP1EqVLe4gOsYqRGwGtRopxRs5R7rr4fKWj3GHxRSy',
       o.id, r.id, 'ACTIVE'
FROM (VALUES
    ('Ventrix Super Admin', 'superadmin@ventrix.com', 'VTX', 'SUPER_ADMIN'),
    ('Ventrix Admin',       'admin@ventrix.com',      'VTX', 'VENTRIX_ADMIN'),
    ('Ventrix Engineer',    'engineer@ventrix.com',   'VTX', 'ENGINEER'),
    ('Ventrix Technician',  'tech@ventrix.com',       'VTX', 'TECHNICIAN'),
    ('Railways Fleet Admin','admin@railways.gov.in',  'IR',  'CUSTOMER_ADMIN'),
    ('Railways Operator',   'operator@railways.gov.in','IR', 'CUSTOMER_USER')
) AS v(name, email, org_code, role_name)
JOIN organizations o ON o.code = v.org_code
JOIN roles r ON r.name = v.role_name
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- Suppliers + Parts + Inventory
-- ---------------------------------------------------------------------
INSERT INTO suppliers (supplier_code, name, contact_person, email, phone, status) VALUES
    ('SUP-001', 'Cooltech Components Pvt Ltd', 'Ramesh Nair', 'sales@coolwtech.example', '+91-9847012345', 'ACTIVE'),
    ('SUP-002', 'Precision Motors India', 'Anjali Menon', 'contact@precisionmotors.example', '+91-9847098765', 'ACTIVE')
ON CONFLICT (supplier_code) DO NOTHING;

INSERT INTO parts (part_code, name, category_id, unit, minimum_stock, unit_price, status)
SELECT v.code, v.name, c.id, 'pcs', v.min_stock, v.price, 'ACTIVE'
FROM (VALUES
    ('VX-COMP-01', 'Scroll Compressor', 'Compressors', 5, 18500.00),
    ('VX-FAN-MOTOR-02', 'Condenser Fan Motor', 'Motors', 10, 4200.00),
    ('VX-FILTER-03', 'Return Air Filter', 'Filters', 30, 350.00),
    ('VX-SENSOR-04', 'Refrigerant Pressure Sensor', 'Sensors', 15, 1200.00),
    ('VX-RELAY-05', 'Compressor Contactor Relay', 'Electrical', 20, 650.00)
) AS v(code, name, cat_name, min_stock, price)
JOIN part_categories c ON c.name = v.cat_name
ON CONFLICT (part_code) DO NOTHING;

INSERT INTO inventory (part_id, location, quantity)
SELECT p.id, 'Main Warehouse', v.qty
FROM (VALUES
    ('VX-COMP-01', 3),
    ('VX-FAN-MOTOR-02', 12),
    ('VX-FILTER-03', 8),
    ('VX-SENSOR-04', 22),
    ('VX-RELAY-05', 4)
) AS v(code, qty)
JOIN parts p ON p.part_code = v.code
ON CONFLICT (part_id, location) DO NOTHING;

-- Record the initial stock as RECEIVED transactions so stock history
-- isn't empty from day one.
INSERT INTO stock_transactions (part_id, inventory_id, transaction_type, quantity, reference_type)
SELECT p.id, i.id, 'RECEIVED', i.quantity, 'manual'
FROM inventory i JOIN parts p ON p.id = i.part_id
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions st WHERE st.part_id = p.id);

-- ---------------------------------------------------------------------
-- Purchase order (VX-FILTER-03 running below its minimum_stock of 30)
-- ---------------------------------------------------------------------
INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, status, subtotal, tax, total)
SELECT 'PO-2026-001', s.id, '2026-08-01', '2026-08-20', 'ORDERED', 7000.00, 350.00, 7350.00
FROM suppliers s WHERE s.supplier_code = 'SUP-001'
ON CONFLICT (po_number) DO NOTHING;

INSERT INTO purchase_order_items (purchase_order_id, part_id, quantity, unit_price)
SELECT po.id, p.id, 20, 350.00
FROM purchase_orders po, parts p
WHERE po.po_number = 'PO-2026-001' AND p.part_code = 'VX-FILTER-03'
  AND NOT EXISTS (
    SELECT 1 FROM purchase_order_items i WHERE i.purchase_order_id = po.id AND i.part_id = p.id
  );

-- ---------------------------------------------------------------------
-- Work order + service request for HVAC-005 (already seeded as
-- MAINTENANCE status back in 004_seed_more_assets.sql)
-- ---------------------------------------------------------------------
INSERT INTO work_orders (asset_id, assigned_to, created_by, title, description, priority, status, due_date)
SELECT a.id, tech.id, eng.id, 'Fan motor inspection', 'Unit flagged MAINTENANCE — inspect and replace fan motor if worn.',
       'HIGH', 'ASSIGNED', CURRENT_DATE + INTERVAL '3 days'
FROM assets a, users tech, users eng
WHERE a.asset_code = 'HVAC-005'
  AND tech.email = 'tech@ventrix.com'
  AND eng.email = 'engineer@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.asset_id = a.id AND wo.title = 'Fan motor inspection');

INSERT INTO service_requests (organization_id, asset_id, created_by, title, description, priority, status)
SELECT o.id, a.id, u.id, 'High vibration on HVAC-005', 'Operator reported unusual vibration noise near the fan assembly.',
       'HIGH', 'ASSIGNED'
FROM assets a
JOIN organizations o ON o.code = 'IR'
JOIN users u ON u.email = 'operator@railways.gov.in'
WHERE a.asset_code = 'HVAC-005'
  AND NOT EXISTS (SELECT 1 FROM service_requests sr WHERE sr.asset_id = a.id AND sr.title = 'High vibration on HVAC-005');
