-- =====================================================================
-- Phase 4 — Spare parts & inventory
-- =====================================================================

CREATE TABLE IF NOT EXISTS part_categories (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL
);

INSERT INTO part_categories (name) VALUES
    ('Compressors'), ('Motors'), ('Filters'), ('Sensors'),
    ('Electrical'), ('Refrigeration')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS parts (
    id              SERIAL PRIMARY KEY,
    part_code       VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(150) NOT NULL,
    category_id     INTEGER REFERENCES part_categories(id) ON DELETE SET NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'pcs',
    minimum_stock   INTEGER NOT NULL DEFAULT 0,
    unit_price      NUMERIC(10,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quantity per warehouse/location. A part can exist in multiple
-- locations — do not put a single stock_quantity on `parts` itself.
CREATE TABLE IF NOT EXISTS inventory (
    id          SERIAL PRIMARY KEY,
    part_id     INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    location    VARCHAR(100) NOT NULL DEFAULT 'Main Warehouse',
    quantity    INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (part_id, location)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id              BIGSERIAL PRIMARY KEY,
    part_id         INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    inventory_id    INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL, -- RECEIVED, USED, RETURNED, ADJUSTED
    quantity        INTEGER NOT NULL,       -- signed: +10 received, -1 used
    reference_type  VARCHAR(30),            -- 'purchase_order', 'work_order', 'manual'
    reference_id    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_txn_part ON stock_transactions (part_id, created_at DESC);

-- A work order can consume specific parts.
CREATE TABLE IF NOT EXISTS work_order_parts (
    id              SERIAL PRIMARY KEY,
    work_order_id   INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    part_id         INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_parts_wo ON work_order_parts (work_order_id);
