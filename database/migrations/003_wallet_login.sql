BEGIN;

CREATE TABLE IF NOT EXISTS login_challenges (
    id UUID PRIMARY KEY,

    participant_id BIGINT NOT NULL
        REFERENCES participants(id)
        ON DELETE CASCADE,

    wallet_address VARCHAR(42) NOT NULL,

    /*
     * This is the exact message that MetaMask
     * will ask the participant to sign.
     */
    challenge_message TEXT NOT NULL,

    /*
     * Challenges are short-lived to prevent
     * old signatures from being reused.
     */
    expires_at TIMESTAMPTZ NOT NULL,

    /*
     * Once a challenge is verified, used_at
     * is set. A used challenge cannot be reused.
     */
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT login_challenge_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS
login_challenges_wallet_index
ON login_challenges (
    LOWER(wallet_address)
);

CREATE INDEX IF NOT EXISTS
login_challenges_active_index
ON login_challenges (
    expires_at,
    used_at
);

COMMIT;