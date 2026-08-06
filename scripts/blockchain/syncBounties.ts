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

const escrowAddress = ethers.getAddress(
  requireEnvironmentVariable(
    "BUG_BOUNTY_ESCROW_ADDRESS"
  )
);

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
 * BountyCreated event from BugBountyEscrow.sol.
 *
 * Solidity enums are not involved in this event,
 * so the ABI uses ordinary Solidity data types.
 */
const escrowInterface = new ethers.Interface([
  "event BountyCreated(uint256 indexed bountyId, address indexed company, bytes32 indexed companyOrganizationId, uint256 escrowAmount, bytes32 metadataHash, string metadataCID, uint64 startTime, uint64 endTime)",
]);

const bountyCreatedEvent =
  escrowInterface.getEvent("BountyCreated");

if (!bountyCreatedEvent) {
  throw new Error(
    "BountyCreated event was not found"
  );
}

const bountyCreatedTopic =
  bountyCreatedEvent.topicHash;

let shouldStop = false;

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function saveBounty(
  client: PoolClient,
  data: {
    chainId: bigint;
    bountyId: bigint;
    companyAddress: string;
    companyOrganizationId: string;
    metadataHash: string;
    metadataCID: string;
    escrowAmount: bigint;
    startTime: bigint;
    endTime: bigint;
    transactionHash: string;
    blockNumber: number;
  }
): Promise<void> {
  /*
   * BountyStatus enum in the contract:
   *
   * 0 = None
   * 1 = Open
   * 2 = Closed
   * 3 = Cancelled
   */
  const openStatus = 1;

  const startDate = new Date(
    Number(data.startTime) * 1_000
  );

  const endDate = new Date(
    Number(data.endTime) * 1_000
  );

  await client.query(
    `
    INSERT INTO bounties (
      chain_id,
      escrow_address,
      bounty_id,
      company_address,
      company_organization_id,
      metadata_hash,
      metadata_cid,
      total_escrow_wei,
      available_escrow_wei,
      start_time,
      end_time,
      refund_available_at,
      status,
      creation_tx_hash,
      block_number
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    ON CONFLICT (
      chain_id,
      escrow_address,
      bounty_id
    )
    DO UPDATE SET
      company_address =
        EXCLUDED.company_address,

      company_organization_id =
        EXCLUDED.company_organization_id,

      metadata_hash =
        EXCLUDED.metadata_hash,

      metadata_cid =
        EXCLUDED.metadata_cid,

      total_escrow_wei =
        EXCLUDED.total_escrow_wei,

      available_escrow_wei =
        EXCLUDED.available_escrow_wei,

      start_time =
        EXCLUDED.start_time,

      end_time =
        EXCLUDED.end_time,

      refund_available_at =
        EXCLUDED.refund_available_at,

      status =
        EXCLUDED.status,

      creation_tx_hash =
        EXCLUDED.creation_tx_hash,

      block_number =
        EXCLUDED.block_number,

      updated_at = NOW();
    `,
    [
      data.chainId.toString(),
      escrowAddress.toLowerCase(),
      data.bountyId.toString(),
      data.companyAddress.toLowerCase(),
      data.companyOrganizationId.toLowerCase(),
      data.metadataHash.toLowerCase(),
      data.metadataCID,
      data.escrowAmount.toString(),
      data.escrowAmount.toString(),
      startDate,
      endDate,
      endDate,
      openStatus,
      data.transactionHash.toLowerCase(),
      data.blockNumber,
    ]
  );

  console.log(
    `Bounty synchronized: ` +
    `bountyId=${data.bountyId}, ` +
    `company=${data.companyAddress}, ` +
    `escrow=${ethers.formatEther(
      data.escrowAmount
    )} ETH, ` +
    `tx=${data.transactionHash}`
  );
}

async function processBountyCreatedLog(
  log: ethers.Log,
  chainId: bigint
): Promise<void> {
  const parsedLog =
    escrowInterface.parseLog(log);

  if (!parsedLog) {
    return;
  }

  const bountyId = BigInt(
    parsedLog.args.bountyId
  );

  const companyAddress =
    ethers.getAddress(
      parsedLog.args.company
    );

  const companyOrganizationId =
    String(
      parsedLog.args.companyOrganizationId
    );

  const escrowAmount = BigInt(
    parsedLog.args.escrowAmount
  );

  const metadataHash = String(
    parsedLog.args.metadataHash
  );

  const metadataCID = String(
    parsedLog.args.metadataCID
  );

  const startTime = BigInt(
    parsedLog.args.startTime
  );

  const endTime = BigInt(
    parsedLog.args.endTime
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await saveBounty(client, {
      chainId,
      bountyId,
      companyAddress,
      companyOrganizationId,
      metadataHash,
      metadataCID,
      escrowAmount,
      startTime,
      endTime,
      transactionHash:
        log.transactionHash,
      blockNumber:
        log.blockNumber,
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
    topics: [bountyCreatedTopic],
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    await processBountyCreatedLog(
      log,
      chainId
    );
  }
}

async function main(): Promise<void> {
  const network =
    await provider.getNetwork();

  const chainId = network.chainId;

  const deployedCode =
    await provider.getCode(
      escrowAddress
    );

  if (deployedCode === "0x") {
    throw new Error(
      `No contract is deployed at ${escrowAddress}`
    );
  }

  console.log(
    "Bounty synchronization worker started"
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
   * Start from block zero so the existing bounty
   * in block 2 is synchronized immediately.
   *
   * ON CONFLICT makes repeated processing safe.
   */
  let nextBlock = 0;

  while (!shouldStop) {
    const latestBlock =
      await provider.getBlockNumber();

    if (nextBlock <= latestBlock) {
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

  console.log(
    "Bounty synchronization worker stopped"
  );
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
    "Bounty synchronization failed:",
    message
  );

  await pool.end();
  provider.destroy();

  process.exitCode = 1;
});