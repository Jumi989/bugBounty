import "dotenv/config";

import { ethers } from "ethers";
import { Pool } from "pg";

export enum ParticipantRole {
  None = 0,
  Company = 1,
  Tester = 2,
}

export enum AuthorizedAction {
  None = 0,
  CreateBounty = 1,
  SubmitBug = 2,
  AcceptSubmission = 3,
  RejectSubmission = 4,
  CancelBounty = 5,
  CloseExpiredBounty = 6,
}

export type AuthorizationMessage = {
  user: string;
  role: number;
  organizationId: string;
  action: number;
  actionHash: string;
  nonce: bigint;
  deadline: bigint;
};

export type IssuedAuthorization = {
  authorization: AuthorizationMessage;
  signature: string;
  digest: string;
};

const AUTHORIZATION_TYPES = {
  Authorization: [
    { name: "user", type: "address" },
    { name: "role", type: "uint8" },
    { name: "organizationId", type: "bytes32" },
    { name: "action", type: "uint8" },
    { name: "actionHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const ESCROW_AUTH_ABI = [
  "function authorizationNonces(address user) view returns (uint256)",
  "function trustedVerifier() view returns (address)",
];

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing from .env`);
  }

  return value;
}

const databaseUrl =
  requiredEnvironmentVariable("DATABASE_URL");

const rpcUrl =
  requiredEnvironmentVariable("RPC_URL");

const escrowAddress =
  requiredEnvironmentVariable(
    "BUG_BOUNTY_ESCROW_ADDRESS"
  );

const verifierPrivateKey =
  requiredEnvironmentVariable(
    "AUTHORIZER_PRIVATE_KEY"
  );

const pool = new Pool({
  connectionString: databaseUrl,
});

const provider = new ethers.JsonRpcProvider(rpcUrl);

const verifierWallet =
  new ethers.Wallet(verifierPrivateKey);

const escrow = new ethers.Contract(
  escrowAddress,
  ESCROW_AUTH_ABI,
  provider
);

export async function issueAuthorization(params: {
  userAddress: string;
  requiredRole: ParticipantRole;
  action: AuthorizedAction;
  actionHash: string;
  lifetimeSeconds?: number;
}): Promise<IssuedAuthorization> {
  const userAddress =
    ethers.getAddress(params.userAddress);

  if (!ethers.isHexString(params.actionHash, 32)) {
    throw new Error("actionHash must be bytes32");
  }

  const participantResult = await pool.query(
    `
    SELECT
      wallet_address,
      participant_type,
      organization_id,
      active,
      verified
    FROM participants
    WHERE LOWER(wallet_address) = LOWER($1)
    LIMIT 1;
    `,
    [userAddress]
  );

  if (participantResult.rowCount !== 1) {
    throw new Error("Participant was not found");
  }

  const participant = participantResult.rows[0];

  if (!participant.active) {
    throw new Error("Participant is inactive");
  }

  if (!participant.verified) {
    throw new Error("Participant is not verified");
  }

  if (
    Number(participant.participant_type) !==
    params.requiredRole
  ) {
    throw new Error("Participant role is not permitted");
  }

  const organizationId =
    String(participant.organization_id).trim();

  if (!ethers.isHexString(organizationId, 32)) {
    throw new Error(
      "Participant organization_id is not bytes32"
    );
  }

  const network = await provider.getNetwork();

  const configuredVerifier =
    ethers.getAddress(await escrow.trustedVerifier());

  if (
    configuredVerifier !==
    ethers.getAddress(verifierWallet.address)
  ) {
    throw new Error(
      "AUTHORIZER_PRIVATE_KEY does not match " +
      "the contract trustedVerifier"
    );
  }

  const nonce: bigint =
    await escrow.authorizationNonces(userAddress);

  const lifetimeSeconds =
    params.lifetimeSeconds ?? 300;

  if (
    lifetimeSeconds < 30 ||
    lifetimeSeconds > 900
  ) {
    throw new Error(
      "Authorization lifetime must be 30-900 seconds"
    );
  }

  const deadline =
    BigInt(Math.floor(Date.now() / 1000) + lifetimeSeconds);

  const domain = {
    name: "BugBountyEscrow",
    version: "1",
    chainId: network.chainId,
    verifyingContract:
      ethers.getAddress(escrowAddress),
  };

  const authorization: AuthorizationMessage = {
    user: userAddress,
    role: params.requiredRole,
    organizationId,
    action: params.action,
    actionHash: params.actionHash,
    nonce,
    deadline,
  };

  const signature =
    await verifierWallet.signTypedData(
      domain,
      AUTHORIZATION_TYPES,
      authorization
    );

  const digest = ethers.TypedDataEncoder.hash(
    domain,
    AUTHORIZATION_TYPES,
    authorization
  );

  await pool.query(
    `
    INSERT INTO authorization_issuances (
      wallet_address,
      participant_type,
      organization_id,
      action,
      action_hash,
      nonce,
      deadline,
      chain_id,
      verifying_contract,
      verifier_address,
      authorization_digest,
      signature
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12
    );
    `,
    [
      userAddress.toLowerCase(),
      params.requiredRole,
      organizationId,
      params.action,
      params.actionHash,
      nonce.toString(),
      new Date(Number(deadline) * 1000),
      network.chainId.toString(),
      escrowAddress.toLowerCase(),
      verifierWallet.address.toLowerCase(),
      digest,
      signature,
    ]
  );

  return {
    authorization,
    signature,
    digest,
  };
}

export async function closeAuthorizationService():
Promise<void> {
  await pool.end();
}
