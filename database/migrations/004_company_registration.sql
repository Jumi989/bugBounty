BEGIN;

CREATE TABLE IF NOT EXISTS company_registration_challenges (
    id UUID PRIMARY KEY,

    /*
     * The wallet trying to create the company account.
     *
     * There is intentionally NO participant_id here
     * because the company does not exist yet.
     */
    wallet_address VARCHAR(42) NOT NULL,

    /*
     * Hash of the company registration form.
     *
     * This binds the MetaMask signature to the exact
     * company information submitted by the user.
     */
    registration_payload_hash CHAR(66) NOT NULL,

    /*
     * Exact message shown to MetaMask for signing.
     */
    challenge_message TEXT NOT NULL,

    /*
     * Short expiration prevents old registration
     * signatures from being reused later.
     */
    expires_at TIMESTAMPTZ NOT NULL,

    /*
     * NULL = challenge has not been consumed.
     *
     * Timestamp = registration challenge was used.
     */
    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT company_registration_challenge_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS
company_registration_challenges_wallet_index
ON company_registration_challenges (
    LOWER(wallet_address)
);

CREATE INDEX IF NOT EXISTS
company_registration_challenges_status_index
ON company_registration_challenges (
    expires_at,
    used_at
);

COMMIT;