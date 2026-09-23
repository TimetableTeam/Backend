-- ============================================================
-- TANSEEK | Migration 004: Super Admin Transfer & Account Activation
-- ============================================================

BEGIN;

-- The super_admin_transfers table already exists in schema
-- We just need to ensure the account_invitations table is properly used for activation

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_super_admin_transfers_outgoing ON super_admin_transfers(outgoing_account_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_transfers_incoming ON super_admin_transfers(incoming_account_id);
CREATE INDEX IF NOT EXISTS idx_account_invitations_token ON account_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_account_invitations_account ON account_invitations(account_id);

-- Add trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables that have updated_at
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at
    BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_versions_updated_at ON schedule_versions;
CREATE TRIGGER update_schedule_versions_updated_at
    BEFORE UPDATE ON schedule_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_submissions_updated_at ON availability_submissions;
CREATE TRIGGER update_availability_submissions_updated_at
    BEFORE UPDATE ON availability_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;