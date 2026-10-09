-- 025_add_hvac_telemetry_columns.sql
-- Add explicit physical HVAC sensor columns to telemetry table for AI feature processing

ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS filter_dp NUMERIC(8,2);
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS cooling_capacity NUMERIC(8,2);
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS compressor_wear NUMERIC(6,4);
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS motor_wear NUMERIC(6,4);
