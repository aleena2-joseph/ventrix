-- =====================================================================
-- Asset Management — Phase 2
-- Extends the existing `assets` table (created in 001_core_schema.sql)
-- with the extra identity/railway/warranty fields Asset Management needs.
-- Deliberately NOT creating a second table — assets already exists and
-- telemetry/predictions/alerts/maintenance_logs already reference it by
-- asset_id, so we alter it in place.
--
-- Fields we already have and are re-using rather than duplicating:
--   zone          -> used as "Location" in the UI (e.g. "Coach A1")
--   install_date  -> used as "Installation Date"
--   metadata      -> used as the "Configuration" JSONB blob
--   status        -> normalized below to the 5-value set the UI uses
-- =====================================================================

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS train_number    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS coach_number    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS manufacturer    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS model           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS serial_number   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS warranty_start  DATE,
    ADD COLUMN IF NOT EXISTS warranty_end    DATE;

-- Normalize status to: OPERATIONAL, WARNING, MAINTENANCE, OFFLINE, DECOMMISSIONED
ALTER TABLE assets ALTER COLUMN status SET DEFAULT 'OPERATIONAL';

UPDATE assets SET status = 'OPERATIONAL' WHERE status = 'Active';
UPDATE assets SET status = 'OFFLINE' WHERE status = 'Idle';
UPDATE assets SET status = 'DECOMMISSIONED' WHERE status = 'Decommissioned';

COMMENT ON COLUMN assets.zone IS 'Displayed as "Location" in the UI, e.g. Coach A1';
COMMENT ON COLUMN assets.metadata IS 'Displayed as "Configuration" in the UI (JSONB: coolingCapacity, ratedVoltage, etc.)';
