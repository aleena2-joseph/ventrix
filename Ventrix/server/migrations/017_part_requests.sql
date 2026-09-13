-- =====================================================================
-- Phase 5 — Spare Parts Requests and Approval System
-- Technicians request parts; Admins/Engineers approve and deduct stock
-- =====================================================================

CREATE TABLE IF NOT EXISTS part_requests (
    id               SERIAL PRIMARY KEY,
    part_id          INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    work_order_id    INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
    requested_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    urgency          VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    reason           TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
    reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests (status);
CREATE INDEX IF NOT EXISTS idx_part_requests_user ON part_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_part_requests_wo ON part_requests (work_order_id);
