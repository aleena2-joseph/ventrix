-- =====================================================================
-- Users table — Phase 0 (must run before 001_core_schema.sql)
-- 001_core_schema.sql has maintenance_logs.performed_by REFERENCES
-- users(id), and authController.js / userModel.js already query this
-- table directly (register/login). It was never created anywhere,
-- so migrations failed with a missing-relation / FK error. This file
-- is named 000_ so the run.js runner (which sorts filenames and runs
-- them in order) applies it first.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password        VARCHAR(255) NOT NULL,   -- bcrypt hash, set by authController.js
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
