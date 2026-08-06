import "dotenv/config";

import { ethers } from "ethers";
import { Pool, PoolClient } from "pg";

function requireEnvironmentVariable(
  name: string
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from .env`
    );
  }

  return value;
}

const databaseUrl =
  requireEnvironmentVariable("DATABASE_URL");

const rpcUrl =
  requireEnvironmentVariable("RPC_URL");

const escrowAddress =
  requireEnvironmentVariable(
    "BUG_BOUNTY_ESCROW_ADDRESS"
  );

/*
 * Force Ethers to use block polling.
 *
 * This avoids depending on temporary JSON-RPC filter IDs,
 * which previously caused problems with the local node.
 */
const provider = new ethers.JsonRpcProvider(
  rpcUrl,
  undefined,
  {
    polling: true,
    pollingInterval: 1_000,
  }
);

const pool = new Pool({
  connectionString: databaseUrl,
});

/*
 * We only need this event definition.
 *
 * Solidity enums appear in the ABI as uint8.
 */
const escrowInterface = new ethers.Interface([
  "event AuthorizationConsumed(address indexed user, uint256 indexed nonce, uint8 indexed action, bytes32 organizationId, bytes32 actionHash)",
]);

const authorizationConsumedEvent =
  escrowInterface.getEvent(
    "AuthorizationConsumed"
  );

if (!authorizationConsumedEvent) {
  throw new Error(
    "AuthorizationConsumed event was not found"
  );
}

const authorizationConsumedTopic =
  authorizationConsumedEvent.topicHash;

let shouldStop = false;

function sleep(milliseconds: number):
Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function updateAuthorizationRecord(
  client: PoolClient,
  data: {
    user: string;
    nonce: bigint;
    action: number;
    actionHash: string;
    transactionHash: string;
    usedAt: Date;
    chainId: bigint;
  }
): Promise<void> {
  const result = await client.query(
    `
    UPDATE authorization_issuances
    SET
      status = 'used',
      used_transaction_hash = $1,
      used_at = $2
    WHERE LOWER(wallet_address) = LOWER($3)
      AND nonce = $4
      AND action = $5
      AND LOWER(action_hash) = LOWER($6)
      AND chain_id = $7
      AND LOWER(verifying_contract) =
          LOWER($8)
      AND status <> 'used'
    RETURNING id;
    `,
    [
      data.transactionHash,
      data.usedAt,
      data.user,
      data.nonce.toString(),
      data.action,
      data.actionHash,
      data.chainId.toString(),
      escrowAddress,
    ]
  );

  if (result.rowCount === 1) {
    console.log(
      `Authorization marked used: ` +
      `wallet=${data.user}, ` +
      `nonce=${data.nonce}, ` +
      `tx=${data.transactionHash}`
    );

    return;
  }

  /*
   * No update can mean:
   *
   * 1. It was already synchronized.
   * 2. No matching issuance row exists.
   */
  const existingResult = await client.query(
    `
    SELECT id, status
    FROM authorization_issuances
    WHERE LOWER(wallet_address) = LOWER($1)
      AND nonce = $2
      AND action = $3
      AND LOWER(action_hash) = LOWER($4)
      AND chain_id = $5
      AND LOWER(verifying_contract) =
          LOWER($6)
    LIMIT 1;
    `,
    [
      data.user,
      data.nonce.toString(),
      data.action,
      data.actionHash,
      data.chainId.toString(),
      escrowAddress,
    ]
  );

  if (existingResult.rowCount === 1) {
    console.log(
      `Authorization already synchronized: ` +
      `wallet=${data.user}, ` +
      `nonce=${data.nonce}`
    );

    return;
  }

  console.warn(
    `No matching PostgreSQL authorization found: ` +
    `wallet=${data.user}, ` +
    `nonce=${data.nonce}, ` +
    `tx=${data.transactionHash}`
  );
}

async function processLog(
  log: ethers.Log,
  chainId: bigint
): Promise<void> {
  const parsedLog =
    escrowInterface.parseLog(log);

  if (!parsedLog) {
    return;
  }

  const user = ethers.getAddress(
    parsedLog.args.user
  );

  const nonce = BigInt(
    parsedLog.args.nonce
  );

  const action = Number(
    parsedLog.args.action
  );

  const actionHash = String(
    parsedLog.args.actionHash
  );

  const block = await provider.getBlock(
    log.blockNumber
  );

  if (!block) {
    throw new Error(
      `Block ${log.blockNumber} was not found`
    );
  }

  const usedAt = new Date(
    Number(block.timestamp) * 1_000
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await updateAuthorizationRecord(client, {
      user,
      nonce,
      action,
      actionHash,
      transactionHash:
        log.transactionHash,
      usedAt,
      chainId,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function synchronizeBlockRange(
  fromBlock: number,
  toBlock: number,
  chainId: bigint
): Promise<void> {
  const logs = await provider.getLogs({
    address: escrowAddress,
    topics: [
      authorizationConsumedTopic,
    ],
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    await processLog(log, chainId);
  }
}

async function main(): Promise<void> {
  const network =
    await provider.getNetwork();

  const chainId = network.chainId;

  const deployedCode =
    await provider.getCode(escrowAddress);

  if (deployedCode === "0x") {
    throw new Error(
      `No contract is deployed at ${escrowAddress}`
    );
  }

  console.log(
    "Authorization synchronization worker started"
  );

  console.log(
    "Chain ID:",
    chainId.toString()
  );

  console.log(
    "Escrow:",
    escrowAddress
  );

  /*
   * Start from block zero so existing events are
   * synchronized when the worker starts.
   *
   * Reprocessing is safe because the database update
   * is idempotent.
   */
  let nextBlock = 0;

  while (!shouldStop) {
    const latestBlock =
      await provider.getBlockNumber();

    if (nextBlock <= latestBlock) {
      /*
       * Process at most 1,000 blocks per request.
       * This avoids extremely large RPC queries.
       */
      const toBlock = Math.min(
        nextBlock + 999,
        latestBlock
      );

      await synchronizeBlockRange(
        nextBlock,
        toBlock,
        chainId
      );

      console.log(
        `Processed blocks ${nextBlock}-${toBlock}`
      );

      nextBlock = toBlock + 1;
    }

    await sleep(1_000);
  }
}

async function shutdown(
  signal: string
): Promise<void> {
  if (shouldStop) {
    return;
  }

  shouldStop = true;

  console.log(
    `\nReceived ${signal}. Stopping worker...`
  );

  await pool.end();

  provider.destroy();

  console.log("Worker stopped.");
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

main().catch(async (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    "Authorization synchronization failed:",
    message
  );

  await pool.end();

  provider.destroy();

  process.exitCode = 1;
});