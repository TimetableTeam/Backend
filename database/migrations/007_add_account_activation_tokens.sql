-- ============================================================
-- TANSEEK | Migration 007: Add Account Activation Tokens Table
-- ============================================================

BEGIN;

-- ============================================================
-- Account Activation Tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS account_activation_tokens (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet
);

CREATE INDEX IF NOT EXISTS idx_account_activation_account ON account_activation_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_account_activation_token ON account_activation_tokens(token_hash);

COMMIT;