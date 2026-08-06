BEGIN;

-- Preserve the old chain-synchronized participant table rather than deleting it.
DO $$
BEGIN
    IF to_regclass('public.participants') IS NOT NULL
       AND to_regclass('public.participants_onchain_legacy') IS NULL THEN
        ALTER TABLE participants
        RENAME TO participants_onchain_legacy;
    END IF;
END
$$;

-- PostgreSQL is now the participant source of truth.
CREATE TABLE IF NOT EXISTS participants (
    id BIGSERIAL PRIMARY KEY,

    wallet_address VARCHAR(42) NOT NULL,
    participant_type SMALLINT NOT NULL
        CHECK (participant_type IN (1, 2)),

    organization_id CHAR(66) NOT NULL,

    -- The backend checks these fields before issuing an authorization.
    active BOOLEAN NOT NULL DEFAULT TRUE,
    verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Kept off-chain for the future validator-selection system.
    validator_candidate BOOLEAN NOT NULL DEFAULT FALSE,

    display_name VARCHAR(150),
    email VARCHAR(320),
    company_name VARCHAR(200),

    -- Flexible non-critical profile data.
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS participants_unique_wallet
ON participants (LOWER(wallet_address));

CREATE UNIQUE INDEX IF NOT EXISTS participants_unique_email
ON participants (LOWER(email))
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS participants_role_status_index
ON participants (participant_type, active, verified);

-- Copy existing local development participants into the new off-chain table.
-- Existing owner-approved registrations are treated as verified for migration.
DO $$
BEGIN
    IF to_regclass('public.participants_onchain_legacy') IS NOT NULL THEN
        INSERT INTO participants (
            wallet_address,
            participant_type,
            organization_id,
            active,
            verified,
            validator_candidate,
            verified_at,
            created_at,
            updated_at
        )
        SELECT
            wallet_address,
            participant_type,
            organization_id,
            active,
            TRUE,
            validator_candidate,
            registered_at,
            created_at,
            updated_at
        FROM participants_onchain_legacy
        ON CONFLICT DO NOTHING;
    END IF;
END
$$;

-- Audit table for authorizations issued by the backend.
CREATE TABLE IF NOT EXISTS authorization_issuances (
    id BIGSERIAL PRIMARY KEY,

    wallet_address VARCHAR(42) NOT NULL,
    participant_type SMALLINT NOT NULL
        CHECK (participant_type IN (1, 2)),
    organization_id CHAR(66) NOT NULL,

    action SMALLINT NOT NULL
        CHECK (action BETWEEN 1 AND 6),
    action_hash CHAR(66) NOT NULL,

    nonce NUMERIC(78, 0) NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,

    chain_id BIGINT NOT NULL,
    verifying_contract VARCHAR(42) NOT NULL,
    verifier_address VARCHAR(42) NOT NULL,

    authorization_digest CHAR(66) NOT NULL UNIQUE,
    signature TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('issued', 'used', 'expired', 'revoked')),

    used_transaction_hash CHAR(66),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS authorization_wallet_nonce_index
ON authorization_issuances (
    LOWER(wallet_address),
    nonce
);

CREATE INDEX IF NOT EXISTS authorization_status_deadline_index
ON authorization_issuances (
    status,
    deadline
);

-- Store trusted organization identifiers with action-specific blockchain data.
ALTER TABLE bounties
ADD COLUMN IF NOT EXISTS company_organization_id CHAR(66);

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS tester_organization_id CHAR(66);

COMMIT;
