-- =====================================================================
-- Phase 3 — Product catalog
-- Product = the HVAC model Ventrix manufactures (e.g. "VX-Rail 500").
-- Asset = one physical installed unit of a product. Kept separate so
-- the same product can be installed many times across many customers.
-- =====================================================================

CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    product_code    VARCHAR(50) UNIQUE NOT NULL,   -- e.g. 'VX-R500'
    name            VARCHAR(150) NOT NULL,          -- e.g. 'VX-Rail 500'
    category        VARCHAR(50) NOT NULL DEFAULT 'RAIL_HVAC', -- RAIL_HVAC, STATION_HVAC
    description     TEXT,
    specifications  JSONB DEFAULT '{}'::jsonb,      -- coolingCapacity, ratedVoltage, etc.
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO products (product_code, name, category, description, specifications) VALUES
    ('VX-R100', 'VX-Rail 100', 'RAIL_HVAC', 'Entry-level single-coach rail HVAC unit.',
        '{"coolingCapacity":"30 kW","ratedVoltage":"415 V","ratedCurrent":"15 A","refrigerant":"R410A","compressorType":"Reciprocating"}'::jsonb),
    ('VX-R400', 'VX-Rail 400', 'RAIL_HVAC', 'Mid-range rail HVAC unit for standard coaches.',
        '{"coolingCapacity":"40 kW","ratedVoltage":"415 V","ratedCurrent":"20 A","refrigerant":"R410A","compressorType":"Scroll"}'::jsonb),
    ('VX-R500', 'VX-Rail 500', 'RAIL_HVAC', 'High-capacity rail HVAC unit for premium coaches.',
        '{"coolingCapacity":"50 kW","ratedVoltage":"415 V","ratedCurrent":"25 A","refrigerant":"R410A","compressorType":"Scroll","fanSpeed":"Variable","controllerVersion":"v2.4"}'::jsonb)
ON CONFLICT (product_code) DO NOTHING;
