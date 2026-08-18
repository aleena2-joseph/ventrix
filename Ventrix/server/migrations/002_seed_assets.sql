-- =====================================================================
-- Seed data — Phase 1
-- Your Railway-Simulation engine currently creates one asset:
-- new HVACAsset("HVAC-001"). We insert a matching row here so telemetry
-- ingestion has a valid asset_id to attach to from day one.
-- Add more rows here as you register more simulated/real assets.
-- =====================================================================

INSERT INTO assets (asset_code, name, asset_type, zone, status, install_date)
VALUES
    ('HVAC-001', 'Coach A1 HVAC Unit', 'HVAC', 'Coach A1', 'Active', '2023-01-15')
ON CONFLICT (asset_code) DO NOTHING;
