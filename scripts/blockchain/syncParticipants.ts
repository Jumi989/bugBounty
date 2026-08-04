import "dotenv/config";

import { ethers } from "ethers";
import { Pool } from "pg";

/*
 * This minimal ABI describes only the event that this worker needs.
 *
 * An ABI is like a menu that tells Ethers.js which contract
 * functions and events are available.
 */
const PARTICIPANT_REGISTRY_ABI = [
  "event ParticipantRegistered(address indexed account, uint8 indexed participantType, bytes32 indexed organizationId)",
];

/*
 * Reads a required environment variable.
 *
 * If the value is missing, the program stops with a clear error.
 */
function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing from the .env file`);
  }

  return value;
}

/*
 * Load configuration from .env.
 */
const databaseUrl = requireEnvironmentVariable("DATABASE_URL");
const rpcUrl = requireEnvironmentVariable("RPC_URL");

const registryAddress = requireEnvironmentVariable(
  "PARTICIPANT_REGISTRY_ADDRESS"
);

/*
 * Pool manages reusable PostgreSQL connections.
 *
 * Real-life example:
 * Instead of hiring a new taxi for every passenger,
 * we keep a small taxi pool ready for use.
 */
const pool = new Pool({
  connectionString: databaseUrl,
});

/*
 * Provider creates the read-only connection to the blockchain node.
 */
const provider = new ethers.JsonRpcProvider(
  rpcUrl,
  undefined,
  {
    polling: true,
    pollingInterval: 1000,
  }
);

/*
 * Create a JavaScript representation of ParticipantRegistry.
 *
 * This object is connected using:
 * 1. Contract address
 * 2. Contract ABI
 * 3. Blockchain provider
 */
const registry = new ethers.Contract(
  registryAddress,
  PARTICIPANT_REGISTRY_ABI,
  provider
);

/*
 * Saves one ParticipantRegistered event.
 */
async function saveParticipantEvent(
  log: ethers.Log
): Promise<void> {
  /*
   * Decode the raw blockchain log using the ABI.
   */
  const parsedLog = registry.interface.parseLog({
    topics: log.topics,
    data: log.data,
  });

  if (!parsedLog) {
    throw new Error("Could not decode ParticipantRegistered event");
  }

  /*
   * Extract event arguments.
   */
  const account = ethers.getAddress(
    parsedLog.args.account
  );

  const participantType = Number(
    parsedLog.args.participantType
  );

  const organizationId =
    parsedLog.args.organizationId as string;

  /*
   * Read the block to obtain its timestamp.
   */
  const block = await provider.getBlock(
    log.blockNumber
  );

  if (!block) {
    throw new Error(
      `Block ${log.blockNumber} could not be found`
    );
  }

  /*
   * Find the connected blockchain's chain ID.
   */
  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();

  /*
   * PostgreSQL uses a client connection for this transaction.
   */
  const client = await pool.connect();

  try {
    /*
     * Start one atomic database transaction.
     */
    await client.query("BEGIN");

    /*
     * Save the raw blockchain event first.
     *
     * ON CONFLICT DO NOTHING prevents duplicate processing.
     */
    const eventResult = await client.query(
      `
      INSERT INTO blockchain_events (
        chain_id,
        contract_address,
        event_name,
        transaction_hash,
        log_index,
        block_number,
        block_hash,
        event_data
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8
      )
      ON CONFLICT (
        chain_id,
        transaction_hash,
        log_index
      )
      DO NOTHING
      RETURNING id;
      `,
      [
        chainId,
        registryAddress.toLowerCase(),
        "ParticipantRegistered",
        log.transactionHash,
        log.index,
        log.blockNumber.toString(),
        log.blockHash,
        JSON.stringify({
          account,
          participantType,
          organizationId,
        }),
      ]
    );

    /*
     * rowCount = 0 means this event was already processed.
     */
    if (eventResult.rowCount === 0) {
      await client.query("ROLLBACK");

      console.log(
        `Skipped duplicate event: ${log.transactionHash}`
      );

      return;
    }

    /*
     * Convert the Unix blockchain timestamp into a JavaScript Date.
     *
     * Blockchain timestamp uses seconds.
     * JavaScript Date uses milliseconds.
     */
    const registeredAt = new Date(
      block.timestamp * 1000
    );

    /*
     * Save the participant.
     *
     * A newly registered participant is:
     * active = true
     * validator_candidate = false
     */
    await client.query(
      `
      INSERT INTO participants (
        chain_id,
        registry_address,
        wallet_address,
        participant_type,
        organization_id,
        active,
        validator_candidate,
        registered_at,
        registration_tx_hash,
        block_number
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      ON CONFLICT DO NOTHING;
      `,
      [
        chainId,
        registryAddress.toLowerCase(),
        account.toLowerCase(),
        participantType,
        organizationId,
        true,
        false,
        registeredAt,
        log.transactionHash,
        log.blockNumber.toString(),
      ]
    );

    /*
     * Both inserts succeeded.
     */
    await client.query("COMMIT");

    const readableType =
      participantType === 1
        ? "Company"
        : participantType === 2
          ? "Tester"
          : "Unknown";

    console.log("Participant synchronized.");
    console.log("Wallet:", account);
    console.log("Type:", readableType);
    console.log("Block:", log.blockNumber);
    console.log("Transaction:", log.transactionHash);
  } catch (error) {
    /*
     * Undo all database changes from this event.
     */
    await client.query("ROLLBACK");

    throw error;
  } finally {
    /*
     * Return the database connection to the pool.
     */
    client.release();
  }
}

/*
 * Read old events that occurred before this worker started.
 *
 * This is called historical synchronization or backfilling.
 */
async function synchronizeHistoricalEvents(): Promise<void> {
  const latestBlock = await provider.getBlockNumber();

  console.log(
    `Searching ParticipantRegistered events from block 0 to ${latestBlock}...`
  );

  const filter =
    registry.filters.ParticipantRegistered();

  const logs = await registry.queryFilter(
    filter,
    0,
    latestBlock
  );

  console.log(
    `Found ${logs.length} historical participant event(s).`
  );

  for (const log of logs) {
    await saveParticipantEvent(log as ethers.Log);
  }
}

/*
 * Listen continuously for new registrations.
 */
async function listenForNewEvents(): Promise<void> {
  console.log(
    "Listening for new ParticipantRegistered events..."
  );

  await registry.on(
    "ParticipantRegistered",
    async (...eventArguments: unknown[]) => {
      /*
       * Ethers.js places the event payload as the final argument.
       */
      const eventPayload = eventArguments[
        eventArguments.length - 1
      ] as {
        log: ethers.Log;
      };

      try {
        await saveParticipantEvent(
          eventPayload.log
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          "Participant synchronization failed:",
          message
        );
      }
    }
  );
}

/*
 * Program entry point.
 */
async function main(): Promise<void> {
  const network = await provider.getNetwork();

  console.log("Participant synchronization worker started.");
  console.log("Chain ID:", network.chainId.toString());
  console.log("Registry:", registryAddress);

  /*
   * First copy previous events.
   */
  await synchronizeHistoricalEvents();

  /*
   * Then wait for future events.
   */
  await listenForNewEvents();
}

/*
 * Close connections safely when Ctrl + C is pressed.
 */
async function shutdown(): Promise<void> {
  console.log("\nStopping participant synchronization worker...");

  await registry.removeAllListeners();
  await pool.end();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    "Participant worker failed:",
    message
  );

  await pool.end();
  process.exitCode = 1;
});