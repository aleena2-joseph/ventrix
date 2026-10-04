-- =====================================================================
-- Migration 020 — Fleet Digital Twin & Maintenance Planner Seed Data
-- =====================================================================

-- 1. Schema Enhancements for Maintenance Planning
ALTER TABLE maintenance_schedules
    ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_maint_sched_assignee ON maintenance_schedules (assigned_to);

-- 2. Ensure Trains & Coaches for Digital Twin
-- Project IR-COACH-UPGRADE was created in 009. Ensure it exists.
INSERT INTO projects (organization_id, project_code, name, description, start_date, status)
SELECT id, 'IR-COACH-UPGRADE', 'Coach HVAC Upgrade Program',
       'Retrofit and monitoring rollout across premium coaches.', '2021-01-01', 'ACTIVE'
FROM organizations WHERE code = 'IR'
ON CONFLICT (project_code) DO NOTHING;

-- Seed Trains: 12951 (Rajdhani Express) and 22436 (Vande Bharat Express)
INSERT INTO trains (project_id, train_number, train_name, status)
SELECT p.id, t.num, t.name, 'ACTIVE'
FROM (VALUES
    ('12951', 'Rajdhani Express (Mumbai - New Delhi)'),
    ('22436', 'Vande Bharat Express (Varanasi - New Delhi)'),
    ('12002', 'Shatabdi Express (New Delhi - Bhopal)')
) AS t(num, name)
CROSS JOIN (SELECT id FROM projects WHERE project_code = 'IR-COACH-UPGRADE') p
ON CONFLICT (project_id, train_number) DO UPDATE
SET train_name = EXCLUDED.train_name;

-- Seed Coaches for Train 12951 (Rajdhani Express)
INSERT INTO coaches (train_id, coach_number, coach_type, status)
SELECT t.id, c.num, c.typ, 'ACTIVE'
FROM (VALUES
    ('A1', 'AC First Class (1A)'),
    ('A2', 'AC 2-Tier (2A)'),
    ('A3', 'AC 2-Tier (2A)'),
    ('A4', 'AC 3-Tier (3A)'),
    ('A5', 'AC 3-Tier (3A)'),
    ('B1', 'AC 3-Tier Economy (3E)'),
    ('PC', 'Pantry Car')
) AS c(num, typ)
CROSS JOIN (SELECT id FROM trains WHERE train_number = '12951') t
ON CONFLICT (train_id, coach_number) DO UPDATE
SET coach_type = EXCLUDED.coach_type;

-- Seed Coaches for Train 22436 (Vande Bharat Express)
INSERT INTO coaches (train_id, coach_number, coach_type, status)
SELECT t.id, c.num, c.typ, 'ACTIVE'
FROM (VALUES
    ('C1', 'Executive Chair Car (EC)'),
    ('C2', 'AC Chair Car (CC)'),
    ('C3', 'AC Chair Car (CC)'),
    ('C4', 'AC Chair Car (CC)')
) AS c(num, typ)
CROSS JOIN (SELECT id FROM trains WHERE train_number = '22436') t
ON CONFLICT (train_id, coach_number) DO UPDATE
SET coach_type = EXCLUDED.coach_type;

-- 3. Associate HVAC Units to Coaches in Train 12951 (2 RMPU units per coach)
-- Coach A1: HVAC-001 (End A) & HVAC-002 (End B)
UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A1' LIMIT 1),
    zone = 'Roof End A (Berths 1-18)',
    status = 'OPERATIONAL'
WHERE asset_code = 'HVAC-001';

UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A1' LIMIT 1),
    zone = 'Roof End B (Berths 19-36)',
    status = 'OPERATIONAL'
WHERE asset_code = 'HVAC-002';

-- Coach A4: HVAC-004 (End A) & HVAC-005 (End B - Degraded)
UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A4' LIMIT 1),
    zone = 'Roof End A (Berths 1-32)',
    status = 'OPERATIONAL'
WHERE asset_code = 'HVAC-004';

UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A4' LIMIT 1),
    zone = 'Roof End B (Berths 33-64)',
    status = 'WARNING'
WHERE asset_code = 'HVAC-005';

-- Coach A3: HVAC-003 (End A)
UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A3' LIMIT 1),
    zone = 'Roof End A (Berths 1-24)',
    status = 'OPERATIONAL'
WHERE asset_code = 'HVAC-003';

-- Coach A5: HVAC-006 (End A)
UPDATE assets
SET coach_id = (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = 'A5' LIMIT 1),
    zone = 'Roof End A (Berths 1-32)',
    status = 'OPERATIONAL'
WHERE asset_code = 'HVAC-006';

-- Seed additional paired units for coaches A2, A3, A5 to complete the digital twins
INSERT INTO assets (asset_code, name, asset_type, zone, status, install_date, serial_number, product_id, coach_id)
SELECT v.code, v.name, 'HVAC', v.zone, v.status, '2023-03-15', v.serial,
       (SELECT id FROM products WHERE product_code = 'VX-R500' LIMIT 1),
       (SELECT c.id FROM coaches c JOIN trains t ON c.train_id = t.id WHERE t.train_number = '12951' AND c.coach_number = v.coach LIMIT 1)
FROM (VALUES
    ('HVAC-007', 'Coach A2 RMPU-1', 'Roof End A (Berths 1-24)', 'OPERATIONAL', 'VT500-007', 'A2'),
    ('HVAC-008', 'Coach A2 RMPU-2', 'Roof End B (Berths 25-48)', 'OPERATIONAL', 'VT500-008', 'A2'),
    ('HVAC-009', 'Coach A3 RMPU-2', 'Roof End B (Berths 25-48)', 'OPERATIONAL', 'VT500-009', 'A3'),
    ('HVAC-010', 'Coach A5 RMPU-2', 'Roof End B (Berths 33-64)', 'OPERATIONAL', 'VT500-010', 'A5')
) AS v(code, name, zone, status, serial, coach)
ON CONFLICT (asset_code) DO NOTHING;

-- 4. Seed Historical Work Orders & Parts Replacement History for Asset Maintenance Profiles
INSERT INTO work_orders (asset_id, assigned_to, created_by, title, description, priority, status, completed_at, due_date)
SELECT a.id, tech.id, eng.id, 'Quarterly Return Air Filter Replacement',
       'Replaced clogged primary and secondary return air filters. Cleaned intake mesh.',
       'MEDIUM', 'COMPLETED', '2026-08-12 14:30:00+05:30', '2026-08-12'
FROM assets a, users tech, users eng
WHERE a.asset_code = 'HVAC-005'
  AND tech.email = 'tech@ventrix.com'
  AND eng.email = 'engineer@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.asset_id = a.id AND wo.title = 'Quarterly Return Air Filter Replacement');

INSERT INTO work_orders (asset_id, assigned_to, created_by, title, description, priority, status, completed_at, due_date)
SELECT a.id, tech.id, eng.id, 'Compressor Bearing Lubrication & Pressure Test',
       'Lubricated scroll compressor bearings. Tested suction line pressure at 4.8 bar.',
       'MEDIUM', 'COMPLETED', '2026-07-05 11:00:00+05:30', '2026-07-05'
FROM assets a, users tech, users eng
WHERE a.asset_code = 'HVAC-001'
  AND tech.email = 'tech@ventrix.com'
  AND eng.email = 'engineer@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.asset_id = a.id AND wo.title = 'Compressor Bearing Lubrication & Pressure Test');

-- Record parts consumed for HVAC-005
INSERT INTO work_order_parts (work_order_id, part_id, quantity)
SELECT wo.id, p.id, 2
FROM work_orders wo, parts p
WHERE wo.title = 'Quarterly Return Air Filter Replacement'
  AND p.part_code = 'VX-FILTER-03'
  AND NOT EXISTS (SELECT 1 FROM work_order_parts wop WHERE wop.work_order_id = wo.id AND wop.part_id = p.id);

INSERT INTO work_order_parts (work_order_id, part_id, quantity)
SELECT wo.id, p.id, 1
FROM work_orders wo, parts p
WHERE wo.title = 'Quarterly Return Air Filter Replacement'
  AND p.part_code = 'VX-SENSOR-04'
  AND NOT EXISTS (SELECT 1 FROM work_order_parts wop WHERE wop.work_order_id = wo.id AND wop.part_id = p.id);

-- 5. Seed Maintenance Schedules for the Digital Maintenance Planner
-- Spans across September and October 2026
INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'PREDICTIVE', '2026-09-20', 'HIGH', 'PENDING', tech.id,
       'Predicted high wear on compressor scroll. Inspect refrigerant subcooling and suction pressure.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-005'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-09-20');

INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'PREVENTIVE', '2026-09-16', 'MEDIUM', 'PENDING', tech.id,
       'Routine depot inspection: return air filter differential pressure check and coil degreasing.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-001'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-09-16');

INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'PREVENTIVE', '2026-09-24', 'LOW', 'PENDING', tech.id,
       'Scheduled monthly condenser fan motor inspection and contactor relay test.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-002'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-09-24');

INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'CORRECTIVE', '2026-09-18', 'HIGH', 'PENDING', tech.id,
       'Investigate vibration elevation and check compressor mounting dampers.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-004'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-09-18');

INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'PREVENTIVE', '2026-10-02', 'LOW', 'PENDING', tech.id,
       'Quarterly overhaul: TXV valve calibration and electrical insulation resistance check.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-003'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-10-02');

INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status, assigned_to, notes)
SELECT a.id, 'PREVENTIVE', '2026-09-28', 'MEDIUM', 'PENDING', tech.id,
       'Routine turnaround servicing: Air filter cleaning and refrigerant pressure log.'
FROM assets a, users tech
WHERE a.asset_code = 'HVAC-007'
  AND tech.email = 'tech@ventrix.com'
  AND NOT EXISTS (SELECT 1 FROM maintenance_schedules ms WHERE ms.asset_id = a.id AND ms.scheduled_date = '2026-09-28');
