-- =====================================================================
-- Phase 4 — Maintenance
-- A completed work_order is itself the historical record (per design),
-- so there's no separate maintenance_history table. The older
-- maintenance_logs table from 001_core_schema.sql is left in place for
-- backward compatibility but new maintenance activity should go through
-- work_orders below.
-- =====================================================================

CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id                  SERIAL PRIMARY KEY,
    asset_id            INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type    VARCHAR(50) NOT NULL,   -- PREVENTIVE, PREDICTIVE, CORRECTIVE
    scheduled_date      DATE NOT NULL,
    priority            VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_sched_asset ON maintenance_schedules (asset_id, scheduled_date);

CREATE TABLE IF NOT EXISTS work_orders (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    schedule_id     INTEGER REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL, -- a TECHNICIAN/ENGINEER user
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    due_date        DATE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_asset ON work_orders (asset_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assignee ON work_orders (assigned_to);
