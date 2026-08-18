-- =====================================================================
-- Phase 3 — Customer → Project → Train → Coach hierarchy
-- =====================================================================

CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_code    VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects (organization_id);

CREATE TABLE IF NOT EXISTS trains (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    train_number    VARCHAR(50) NOT NULL,
    train_name      VARCHAR(150),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, train_number)
);

CREATE INDEX IF NOT EXISTS idx_trains_project ON trains (project_id);

CREATE TABLE IF NOT EXISTS coaches (
    id              SERIAL PRIMARY KEY,
    train_id        INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    coach_number    VARCHAR(50) NOT NULL,
    coach_type      VARCHAR(50), -- AC First, AC 2-tier, AC 3-tier, Sleeper, etc.
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (train_id, coach_number)
);

CREATE INDEX IF NOT EXISTS idx_coaches_train ON coaches (train_id);
