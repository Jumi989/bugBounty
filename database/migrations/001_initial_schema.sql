BEGIN;

-- Stores synchronized participant information from ParticipantRegistry.
CREATE TABLE IF NOT EXISTS participants (
    id BIGSERIAL PRIMARY KEY,

    chain_id BIGINT NOT NULL,
    registry_address VARCHAR(42) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,

    participant_type SMALLINT NOT NULL
        CHECK (participant_type IN (1, 2)),

    organization_id CHAR(66) NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,
    validator_candidate BOOLEAN NOT NULL DEFAULT FALSE,

    registered_at TIMESTAMPTZ NOT NULL,

    registration_tx_hash CHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevents the same wallet from being inserted twice
-- for the same registry and blockchain.
CREATE UNIQUE INDEX IF NOT EXISTS participants_unique_wallet
ON participants (
    chain_id,
    LOWER(registry_address),
    LOWER(wallet_address)
);


-- Stores synchronized bounty information from BugBountyEscrow.
CREATE TABLE IF NOT EXISTS bounties (
    id BIGSERIAL PRIMARY KEY,

    chain_id BIGINT NOT NULL,
    escrow_address VARCHAR(42) NOT NULL,

    -- NUMERIC(78,0) can safely store Solidity uint256 values.
    bounty_id NUMERIC(78, 0) NOT NULL,

    company_address VARCHAR(42) NOT NULL,

    metadata_hash CHAR(66) NOT NULL,
    metadata_cid TEXT NOT NULL,

    total_escrow_wei NUMERIC(78, 0) NOT NULL,
    available_escrow_wei NUMERIC(78, 0) NOT NULL,

    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    refund_available_at TIMESTAMPTZ,

    status SMALLINT NOT NULL,

    creation_tx_hash CHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        chain_id,
        escrow_address,
        bounty_id
    )
);


-- Stores synchronized vulnerability submissions.
CREATE TABLE IF NOT EXISTS submissions (
    id BIGSERIAL PRIMARY KEY,

    chain_id BIGINT NOT NULL,
    escrow_address VARCHAR(42) NOT NULL,

    submission_id NUMERIC(78, 0) NOT NULL,
    bounty_id NUMERIC(78, 0) NOT NULL,

    tester_address VARCHAR(42) NOT NULL,

    report_hash CHAR(66) NOT NULL,
    encrypted_evidence_cid TEXT NOT NULL,

    rejection_reason_hash CHAR(66),

    requested_reward_wei NUMERIC(78, 0) NOT NULL,
    approved_reward_wei NUMERIC(78, 0) NOT NULL DEFAULT 0,

    submitted_at TIMESTAMPTZ NOT NULL,
    rejected_at TIMESTAMPTZ,

    status SMALLINT NOT NULL,

    submission_tx_hash CHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        chain_id,
        escrow_address,
        submission_id
    )
);


-- Stores raw contract events.
-- This prevents the event listener from processing an event twice.
CREATE TABLE IF NOT EXISTS blockchain_events (
    id BIGSERIAL PRIMARY KEY,

    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,

    event_name VARCHAR(100) NOT NULL,

    transaction_hash CHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,

    block_number BIGINT NOT NULL,
    block_hash CHAR(66) NOT NULL,

    event_data JSONB NOT NULL,

    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        chain_id,
        transaction_hash,
        log_index
    )
);


-- Helpful indexes for dashboard searches.
CREATE INDEX IF NOT EXISTS bounties_company_index
ON bounties (LOWER(company_address));

CREATE INDEX IF NOT EXISTS bounties_status_index
ON bounties (status);

CREATE INDEX IF NOT EXISTS submissions_bounty_index
ON submissions (bounty_id);

CREATE INDEX IF NOT EXISTS submissions_tester_index
ON submissions (LOWER(tester_address));

CREATE INDEX IF NOT EXISTS submissions_status_index
ON submissions (status);

CREATE INDEX IF NOT EXISTS blockchain_events_block_index
ON blockchain_events (block_number);

COMMIT;