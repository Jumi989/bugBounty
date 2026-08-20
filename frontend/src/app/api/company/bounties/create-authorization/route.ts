import { ethers } from "ethers";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPinata } from "@/lib/pinata";

import { database } from "@/lib/database";

export const runtime = "nodejs";

/*
 * Contract constants.
 *
 * ParticipantRole.Company = 1
 * AuthorizedAction.CreateBounty = 1
 */
const COMPANY_ROLE = 1;
const CREATE_BOUNTY_ACTION = 1;

const AUTHORIZATION_TYPES = {
  Authorization: [
    {
      name: "user",
      type: "address",
    },
    {
      name: "role",
      type: "uint8",
    },
    {
      name: "organizationId",
      type: "bytes32",
    },
    {
      name: "action",
      type: "uint8",
    },
    {
      name: "actionHash",
      type: "bytes32",
    },
    {
      name: "nonce",
      type: "uint256",
    },
    {
      name: "deadline",
      type: "uint256",
    },
  ],
};

const ESCROW_ABI = [
  "function trustedVerifier() view returns (address)",
  "function authorizationNonces(address user) view returns (uint256)",
];

const requestSchema = z.object({
  walletAddress: z.string(),

  title: z
    .string()
    .trim()
    .min(3)
    .max(200),

  description: z
    .string()
    .trim()
    .min(10)
    .max(5000),

  scope: z
    .string()
    .trim()
    .min(3)
    .max(5000),

  /*
   * 0 means start immediately.
   */
  startTime: z
    .number()
    .int()
    .nonnegative(),

  endTime: z
    .number()
    .int()
    .positive(),

  escrowAmountEth: z.string(),
});

type ParticipantRow = {
  id: string;
  wallet_address: string;
  participant_type: number;
  organization_id: string;
  active: boolean;
  verified: boolean;
};

function requiredEnvironmentVariable(
  name: string
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from environment`
    );
  }

  return value;
}

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    /*
     * ========================================
     * STEP 1
     * Authenticate the browser session
     * ========================================
     */

    const sessionSecret =
      requiredEnvironmentVariable(
        "AUTH_SESSION_SECRET"
      );

    const cookieStore =
      await cookies();

    const sessionToken =
      cookieStore.get(
        "bugbounty_session"
      )?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          code: "NOT_AUTHENTICATED",
          message:
            "You must sign in before creating a bounty.",
        },
        {
          status: 401,
        }
      );
    }

    let sessionPayload;

    try {
      const verifiedToken =
        await jwtVerify(
          sessionToken,
          new TextEncoder().encode(
            sessionSecret
          ),
          {
            algorithms: ["HS256"],
          }
        );

      sessionPayload =
        verifiedToken.payload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_SESSION",
          message:
            "Your session has expired. Please sign in again.",
        },
        {
          status: 401,
        }
      );
    }

    const participantId =
      sessionPayload.participantId;

    const sessionWallet =
      sessionPayload.walletAddress;

    if (
      (
        typeof participantId !==
          "string" &&
        typeof participantId !==
          "number"
      ) ||
      typeof sessionWallet !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_SESSION",
          message:
            "The company session is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ========================================
     * STEP 2
     * Validate bounty request
     * ========================================
     */

    const requestBody: unknown =
      await request.json();

    const validation =
      requestSchema.safeParse(
        requestBody
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_BOUNTY_DATA",
          message:
            "Some bounty information is invalid.",
          errors:
            validation.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    let walletAddress: string;

    try {
      walletAddress =
        ethers.getAddress(
          validation.data.walletAddress
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_WALLET",
          message:
            "The connected wallet address is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Session wallet and submitted wallet
     * must be the same.
     */
    if (
      walletAddress.toLowerCase() !==
      sessionWallet.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SESSION_WALLET_MISMATCH",
          message:
            "The connected wallet does not match the authenticated company.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ========================================
     * STEP 3
     * Recheck PostgreSQL authorization
     * ========================================
     */

    const participantResult =
      await database.query<ParticipantRow>(
        `
        SELECT
          id,
          wallet_address,
          participant_type,
          organization_id,
          active,
          verified
        FROM participants
        WHERE id = $1
        LIMIT 1;
        `,
        [participantId]
      );

    if (
      participantResult.rowCount !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "COMPANY_NOT_FOUND",
          message:
            "The company account was not found.",
        },
        {
          status: 403,
        }
      );
    }

    const participant =
      participantResult.rows[0];

    if (
      participant.wallet_address
        .toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "COMPANY_WALLET_MISMATCH",
          message:
            "This wallet does not belong to the authenticated company.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      Number(
        participant.participant_type
      ) !== COMPANY_ROLE
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "NOT_A_COMPANY",
          message:
            "Only company accounts can create bounties.",
        },
        {
          status: 403,
        }
      );
    }

    if (!participant.active) {
      return NextResponse.json(
        {
          success: false,
          code: "COMPANY_INACTIVE",
          message:
            "This company account is inactive.",
        },
        {
          status: 403,
        }
      );
    }

    if (!participant.verified) {
      return NextResponse.json(
        {
          success: false,
          code: "COMPANY_NOT_VERIFIED",
          message:
            "This company has not been verified.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      String(
        participant.organization_id
      ).trim();

    if (
      !ethers.isHexString(
        organizationId,
        32
      )
    ) {
      throw new Error(
        "Company organization_id is not a valid bytes32 value."
      );
    }

    /*
     * ========================================
     * STEP 4
     * Validate escrow + dates
     * ========================================
     */

    let escrowAmount: bigint;

    try {
      escrowAmount =
        ethers.parseEther(
          validation.data.escrowAmountEth
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_ESCROW_AMOUNT",
          message:
            "The escrow amount is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    if (escrowAmount <= BigInt(0)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_ESCROW_AMOUNT",
          message:
            "Escrow amount must be greater than zero.",
        },
        {
          status: 400,
        }
      );
    }

    const startTime =
      BigInt(
        validation.data.startTime
      );

    const endTime =
      BigInt(
        validation.data.endTime
      );

    const currentTime =
      BigInt(
        Math.floor(
          Date.now() / 1000
        )
      );

    if (
      startTime !== BigInt(0) &&
      startTime < currentTime
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_START_TIME",
          message:
            "The bounty start time cannot be in the past.",
        },
        {
          status: 400,
        }
      );
    }

    const effectiveStartTime =
      startTime === BigInt(0)
        ? currentTime
        : startTime;

    if (
      endTime <=
      effectiveStartTime
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_END_TIME",
          message:
            "The bounty end time must be after its start time.",
        },
        {
          status: 400,
        }
      );
    }

/*
 * ========================================
 * STEP 5
 * Build bounty metadata
 * ========================================
 *
 * This is the actual JSON document that
 * will be stored on IPFS.
 */

const bountyMetadata = {
  schemaVersion: 1,

  type:
    "bug-bounty-program",

  title:
    validation.data.title,

  description:
    validation.data.description,

  scope:
    validation.data.scope,
};

/*
 * Serialize it once.
 *
 * We hash these exact bytes and upload
 * these exact bytes to IPFS.
 */
const metadataJson =
  JSON.stringify(
    bountyMetadata
  );

const metadataHash =
  ethers.keccak256(
    ethers.toUtf8Bytes(
      metadataJson
    )
  );
    /*
     * ========================================
     * STEP 6
     * Connect backend to escrow
     * ========================================
     */

    const rpcUrl =
      requiredEnvironmentVariable(
        "RPC_URL"
      );

    const escrowAddress =
      ethers.getAddress(
        requiredEnvironmentVariable(
          "BUG_BOUNTY_ESCROW_ADDRESS"
        )
      );

    const authorizerPrivateKey =
      requiredEnvironmentVariable(
        "AUTHORIZER_PRIVATE_KEY"
      );

    const provider =
      new ethers.JsonRpcProvider(
        rpcUrl
      );

    const verifier =
      new ethers.Wallet(
        authorizerPrivateKey
      );

    const escrow =
      new ethers.Contract(
        escrowAddress,
        ESCROW_ABI,
        provider
      );

    const network =
      await provider.getNetwork();

    const configuredChainId =
      BigInt(
        requiredEnvironmentVariable(
          "CHAIN_ID"
        )
      );

    if (
      network.chainId !==
      configuredChainId
    ) {
      throw new Error(
        `RPC chain ID ${network.chainId} does not match configured CHAIN_ID ${configuredChainId}.`
      );
    }

    /*
     * Make sure our private key is actually the
     * trusted verifier configured in the contract.
     */
    const trustedVerifier =
      ethers.getAddress(
        await escrow.trustedVerifier()
      );

    if (
      trustedVerifier !==
      ethers.getAddress(
        verifier.address
      )
    ) {
      throw new Error(
        "AUTHORIZER_PRIVATE_KEY does not match the contract trustedVerifier."
      );
    }

    const nonce: bigint =
      await escrow.authorizationNonces(
        walletAddress
      );

      /*
 * ========================================
 * STEP 7
 * Upload bounty metadata to IPFS
 * ========================================
 */

const pinata =
  getPinata();

/*
 * Upload the exact JSON bytes that we
 * hashed above.
 */
const metadataFile =
  new File(
    [metadataJson],
    "bounty-metadata.json",
    {
      type: "application/json",
    }
  );

const upload =
  await pinata.upload.public
    .file(metadataFile)
    .name(
      `bounty-${Date.now()}.json`
    )
    .keyvalues({
      type:
        "bug-bounty-metadata",

      company:
        walletAddress.toLowerCase(),
    });

const metadataCID =
  `ipfs://${upload.cid}`;

  const abiCoder =
  ethers.AbiCoder.defaultAbiCoder();

const actionHash =
  ethers.keccak256(
    abiCoder.encode(
      [
        "bytes32",
        "bytes32",
        "uint64",
        "uint64",
        "uint256",
      ],
      [
        metadataHash,

        ethers.keccak256(
          ethers.toUtf8Bytes(
            metadataCID
          )
        ),

        startTime,
        endTime,
        escrowAmount,
      ]
    )
  );

console.log(
  "Bounty metadata uploaded:",
  metadataCID
);

    /*
     * Authorization lasts five minutes.
     */
    const deadline =
      BigInt(
        Math.floor(
          Date.now() / 1000
        ) + 300
      );

    /*
     * ========================================
     * STEP 7
     * Sign EIP-712 authorization
     * ========================================
     */

    const domain = {
      name: "BugBountyEscrow",

      version: "1",

      chainId:
        network.chainId,

      verifyingContract:
        escrowAddress,
    };

    const authorization = {
      user:
        walletAddress,

      role:
        COMPANY_ROLE,

      organizationId,

      action:
        CREATE_BOUNTY_ACTION,

      actionHash,

      nonce,

      deadline,
    };

    const signature =
      await verifier.signTypedData(
        domain,
        AUTHORIZATION_TYPES,
        authorization
      );

    const authorizationDigest =
      ethers.TypedDataEncoder.hash(
        domain,
        AUTHORIZATION_TYPES,
        authorization
      );

    /*
     * ========================================
     * STEP 8
     * Audit authorization issuance
     * ========================================
     */

    await database.query(
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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      );
      `,
      [
        walletAddress.toLowerCase(),

        COMPANY_ROLE,

        organizationId,

        CREATE_BOUNTY_ACTION,

        actionHash,

        nonce.toString(),

        new Date(
          Number(deadline) *
            1000
        ),

        network.chainId.toString(),

        escrowAddress.toLowerCase(),

        verifier.address.toLowerCase(),

        authorizationDigest,

        signature,
      ]
    );

    /*
     * BigInt cannot be directly serialized to JSON,
     * so convert blockchain integers to strings.
     */
    return NextResponse.json({
      success: true,

      message:
        "Create-bounty authorization issued.",

      contract: {
        address:
          escrowAddress,

        chainId:
          network.chainId.toString(),
      },

      bounty: {
        title:
          validation.data.title,

        description:
          validation.data.description,

        scope:
          validation.data.scope,

        metadataHash,

        metadataCID,

        startTime:
          startTime.toString(),

        endTime:
          endTime.toString(),

        escrowAmountWei:
          escrowAmount.toString(),

        escrowAmountEth:
          validation.data
            .escrowAmountEth,
      },

      authorization: {
        user:
          authorization.user,

        role:
          authorization.role,

        organizationId:
          authorization.organizationId,

        action:
          authorization.action,

        actionHash:
          authorization.actionHash,

        nonce:
          authorization.nonce.toString(),

        deadline:
          authorization.deadline.toString(),
      },

      signature,

      authorizationDigest,
    });
  } catch (error: unknown) {
  console.error(
    "CREATE BOUNTY AUTHORIZATION ERROR:",
    error
  );

  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error);

  return NextResponse.json(
    {
      success: false,
      message:
        process.env.NODE_ENV ===
        "development"
          ? errorMessage
          : "The bounty authorization could not be created.",
    },
    {
      status: 500,
    }
  );
}
}