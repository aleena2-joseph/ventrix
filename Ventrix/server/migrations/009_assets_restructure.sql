-- =====================================================================
-- Phase 3 — Restructure assets onto the normalized hierarchy
--
-- Previously assets stored train_number/coach_number/manufacturer/model
-- directly (denormalized). Now:
--   assets.product_id -> products.id   (what it IS)
--   assets.coach_id    -> coaches.id   (where it's installed)
-- and coach -> train -> project -> organization gives you the customer,
-- so we never need a customer_id column on assets at all.
--
-- This migration also backfills a real project/train/coach hierarchy
-- under Indian Railways for the HVAC-001..006 demo assets seeded in
-- 002_seed_assets.sql / 004_seed_more_assets.sql, so no demo data is
-- lost — it's just properly normalized.
-- =====================================================================

-- 1. A demo project for Indian Railways to hang the existing assets off.
INSERT INTO projects (organization_id, project_code, name, description, start_date, status)
SELECT id, 'IR-COACH-UPGRADE', 'Coach HVAC Upgrade Program',
       'Retrofit and monitoring rollout across premium coaches.', '2021-01-01', 'ACTIVE'
FROM organizations WHERE code = 'IR'
ON CONFLICT (project_code) DO NOTHING;

-- 2. Trains, one per distinct train_number already present on assets.
INSERT INTO trains (project_id, train_number, train_name, status)
SELECT p.id, a.train_number, 'Train ' || a.train_number, 'ACTIVE'
FROM (SELECT DISTINCT train_number FROM assets WHERE train_number IS NOT NULL) a
CROSS JOIN (SELECT id FROM projects WHERE project_code = 'IR-COACH-UPGRADE') p
ON CONFLICT (project_id, train_number) DO NOTHING;

-- 3. Coaches, one per distinct (train_number, coach_number) pair.
INSERT INTO coaches (train_id, coach_number, coach_type, status)
SELECT t.id, a.coach_number, 'AC 2-tier', 'ACTIVE'
FROM (SELECT DISTINCT train_number, coach_number FROM assets
      WHERE train_number IS NOT NULL AND coach_number IS NOT NULL) a
JOIN trains t ON t.train_number = a.train_number
JOIN projects p ON t.project_id = p.id AND p.project_code = 'IR-COACH-UPGRADE'
ON CONFLICT (train_id, coach_number) DO NOTHING;

-- 4. New columns on assets.
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS coach_id   INTEGER REFERENCES coaches(id) ON DELETE SET NULL;

-- 5. Backfill product_id from the old model string.
UPDATE assets SET product_id = (SELECT id FROM products WHERE product_code = 'VX-R500')
WHERE model = 'VTX-HU-500';
UPDATE assets SET product_id = (SELECT id FROM products WHERE product_code = 'VX-R400')
WHERE model = 'VTX-HU-400';

-- 6. Backfill coach_id from the old train_number/coach_number strings.
UPDATE assets a
SET coach_id = c.id
FROM coaches c
JOIN trains t ON c.train_id = t.id
JOIN projects p ON t.project_id = p.id AND p.project_code = 'IR-COACH-UPGRADE'
WHERE t.train_number = a.train_number
  AND c.coach_number = a.coach_number;

-- 7. Drop the now-redundant denormalized columns.
ALTER TABLE assets
    DROP COLUMN IF EXISTS train_number,
    DROP COLUMN IF EXISTS coach_number,
    DROP COLUMN IF EXISTS manufacturer,
    DROP COLUMN IF EXISTS model;

CREATE INDEX IF NOT EXISTS idx_assets_coach ON assets (coach_id);
CREATE INDEX IF NOT EXISTS idx_assets_product ON assets (product_id);

COMMENT ON COLUMN assets.zone IS 'Free-text exact position note (e.g. "Above door 2"). Train/coach/customer now come from coach_id, not this field.';
