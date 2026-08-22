BEGIN;

-- Add username for tester accounts.
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS username VARCHAR(80);

-- Tester usernames must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS participants_unique_tester_username
ON participants (LOWER(username))
WHERE participant_type = 2
  AND username IS NOT NULL;


-- One-time MetaMask challenge used when
-- a new tester registers.
CREATE TABLE IF NOT EXISTS tester_registration_challenges (
    id UUID PRIMARY KEY,

    wallet_address VARCHAR(42) NOT NULL,

    registration_payload_hash CHAR(66) NOT NULL,

    challenge_message TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT tester_registration_challenge_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS
tester_registration_challenges_wallet_index
ON tester_registration_challenges (
    LOWER(wallet_address)
);

CREATE INDEX IF NOT EXISTS
tester_registration_challenges_status_index
ON tester_registration_challenges (
    expires_at,
    used_at
);


-- Private vulnerability reports.
-- These reports are NOT stored on-chain.
CREATE TABLE IF NOT EXISTS vulnerability_reports (
    id BIGSERIAL PRIMARY KEY,

    bounty_db_id BIGINT NOT NULL
        REFERENCES bounties(id)
        ON DELETE CASCADE,

    tester_id BIGINT NOT NULL
        REFERENCES participants(id)
        ON DELETE CASCADE,

    tester_wallet VARCHAR(42) NOT NULL,

    title VARCHAR(200) NOT NULL,

    severity VARCHAR(10) NOT NULL
        CHECK (
            severity IN (
                'Critical',
                'High',
                'Medium',
                'Low'
            )
        ),

    description TEXT NOT NULL,

    steps_to_reproduce TEXT NOT NULL,

    evidence_url TEXT,

    report_hash CHAR(66) NOT NULL,

    status VARCHAR(20) NOT NULL
        DEFAULT 'submitted'
        CHECK (
            status IN (
                'submitted',
                'rejected',
                'accepted',
                'claimed'
            )
        ),

    approved_reward_wei NUMERIC(78, 0),

    payout_nonce NUMERIC(78, 0),

    payout_deadline TIMESTAMPTZ,

    company_signature TEXT,

    reviewed_at TIMESTAMPTZ,

    claimed_at TIMESTAMPTZ,

    claim_transaction_hash CHAR(66),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    UNIQUE (
        bounty_db_id,
        report_hash
    )
);


CREATE INDEX IF NOT EXISTS
vulnerability_reports_bounty_index
ON vulnerability_reports (
    bounty_db_id,
    status
);

CREATE INDEX IF NOT EXISTS
vulnerability_reports_tester_index
ON vulnerability_reports (
    tester_id,
    status
);

COMMIT;