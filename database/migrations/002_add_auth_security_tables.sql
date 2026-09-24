-- ============================================================
-- TANSEEK | Migration 002: Add Auth & Security Tables
-- Adds password reset, super admin transfer, account activation
-- ============================================================

BEGIN;

-- ============================================================
-- Password Reset Tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet
);
CREATE INDEX IF NOT EXISTS idx_password_reset_account ON password_reset_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);

-- ============================================================
-- Email Queue (for async email sending)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_queue (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    to_email varchar(254) NOT NULL,
    subject varchar(500) NOT NULL,
    body_text text,
    body_html text,
    status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','RETRY')),
    attempts smallint NOT NULL DEFAULT 0,
    last_error text,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_at);

-- ============================================================
-- Add SUPER_ADMIN transfer audit logging
-- ============================================================
-- The super_admin_transfers table already exists, but we need to ensure
-- audit logging for transfer events. This is handled in the service layer.

COMMIT;