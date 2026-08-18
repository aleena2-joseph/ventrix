-- =====================================================================
-- Phase 4 — Customer-raised service requests + asset documents
-- =====================================================================

CREATE TABLE IF NOT EXISTS service_requests (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',   -- OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED
    work_order_id   INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_service_requests_org ON service_requests (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_service_requests_asset ON service_requests (asset_id);

CREATE TABLE IF NOT EXISTS asset_documents (
    id              SERIAL PRIMARY KEY,
    asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    document_type   VARCHAR(50), -- MANUAL, WARRANTY_CARD, INSPECTION_REPORT, OTHER
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON asset_documents (asset_id);
