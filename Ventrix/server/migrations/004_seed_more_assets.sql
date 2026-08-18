-- =====================================================================
-- Seed data — Phase 2
-- Additional demo HVAC units so Asset Management has something
-- meaningful to display. HVAC-001 already exists from 002_seed_assets.sql
-- (we only fill in its new columns here); HVAC-002..006 are new.
-- Matches the asset codes already referenced as placeholders in the
-- Dashboard UI (HVAC-002, HVAC-004, HVAC-005, HVAC-006) so real data
-- now backs what was previously hardcoded.
-- =====================================================================

UPDATE assets SET
    train_number   = 'TR-101',
    coach_number   = 'C01',
    manufacturer   = 'Ventrix',
    model          = 'VTX-HU-500',
    serial_number  = 'VT500-001',
    warranty_start = '2023-01-15',
    warranty_end   = '2026-01-15',
    metadata       = '{"coolingCapacity":"50 kW","ratedVoltage":"415 V","ratedCurrent":"25 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Variable","controllerVersion":"v2.4"}'::jsonb
WHERE asset_code = 'HVAC-001';

INSERT INTO assets
    (asset_code, name, asset_type, zone, status, install_date,
     train_number, coach_number, manufacturer, model, serial_number,
     warranty_start, warranty_end, metadata)
VALUES
    ('HVAC-002', 'Coach A2 HVAC Unit', 'HVAC', 'Coach A2', 'OPERATIONAL', '2023-02-10',
     'TR-101', 'C02', 'Ventrix', 'VTX-HU-500', 'VT500-002',
     '2023-02-10', '2026-02-10',
     '{"coolingCapacity":"50 kW","ratedVoltage":"415 V","ratedCurrent":"25 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Variable","controllerVersion":"v2.4"}'::jsonb),

    ('HVAC-003', 'Coach B4 HVAC Unit', 'HVAC', 'Coach B4', 'WARNING', '2022-11-05',
     'TR-102', 'C04', 'Ventrix', 'VTX-HU-500', 'VT500-003',
     '2022-11-05', '2025-11-05',
     '{"coolingCapacity":"50 kW","ratedVoltage":"415 V","ratedCurrent":"25 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Variable","controllerVersion":"v2.3"}'::jsonb),

    ('HVAC-004', 'Coach B2 HVAC Unit', 'HVAC', 'Coach B2', 'WARNING', '2022-11-05',
     'TR-103', 'C02', 'Ventrix', 'VTX-HU-500', 'VT500-004',
     '2022-11-05', '2025-11-05',
     '{"coolingCapacity":"50 kW","ratedVoltage":"415 V","ratedCurrent":"25 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Variable","controllerVersion":"v2.3"}'::jsonb),

    ('HVAC-005', 'Coach C01 HVAC Unit', 'HVAC', 'Coach C01', 'MAINTENANCE', '2021-06-20',
     'TR-104', 'C01', 'Ventrix', 'VTX-HU-400', 'VT400-005',
     '2021-06-20', '2024-06-20',
     '{"coolingCapacity":"40 kW","ratedVoltage":"415 V","ratedCurrent":"20 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Fixed","controllerVersion":"v2.1"}'::jsonb),

    ('HVAC-006', 'Coach C03 HVAC Unit', 'HVAC', 'Coach C03', 'OFFLINE', '2021-06-20',
     'TR-104', 'C03', 'Ventrix', 'VTX-HU-400', 'VT400-006',
     '2021-06-20', '2024-06-20',
     '{"coolingCapacity":"40 kW","ratedVoltage":"415 V","ratedCurrent":"20 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Fixed","controllerVersion":"v2.1"}'::jsonb)
ON CONFLICT (asset_code) DO NOTHING;
