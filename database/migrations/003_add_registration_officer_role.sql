-- ============================================================
-- TANSEEK | Migration 003: Add REGISTRATION_OFFICER Role & Permissions
-- ============================================================

BEGIN;

-- Add REGISTRATION_OFFICER to account_role enum
ALTER TYPE account_role ADD VALUE IF NOT EXISTS 'REGISTRATION_OFFICER';

-- Update ALL_STAFF_ROLES constant in authorize.js will need to be updated in code

-- Add department grants for REGISTRATION_OFFICER (can manage registrations in their department)
-- This is handled by the authorize middleware

COMMIT;