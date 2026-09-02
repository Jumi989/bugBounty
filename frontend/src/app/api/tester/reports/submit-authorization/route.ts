import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ethers } from "ethers";
import { database } from "@/lib/database";

export const runtime = "nodejs";

type SessionPayload = {
  participantId?: string;
  walletAddress?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SESSION_SECRET;

    if (!secret) {
      throw new Error("AUTH_SESSION_SECRET is missing");
    }

    const cookieStore = await cookies();

    const token =
      cookieStore.get("bugbounty_session")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
      }
    );

    const session =
      verified.payload as SessionPayload;

    if (
      session.role !== "tester" ||
      !session.participantId ||
      !session.walletAddress
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated as Bug Hunter",
        },
        { status: 403 }
      );
    }

    const result = await database.query(
      `
      SELECT
        id,
        wallet_address,
        organization_id,
        active,
        verified
      FROM participants
      WHERE id = $1
      LIMIT 1
      `,
      [session.participantId]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: "Tester account not found",
        },
        { status: 404 }
      );
    }

    const tester = result.rows[0];

    if (!tester.active || !tester.verified) {
      return NextResponse.json(
        {
          success: false,
          message: "Tester account is inactive or unverified",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      bountyId,
      reportId,
      reportHash,
    } = body;

    if (!bountyId || !reportId || !reportHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing authorization information",
        },
        { status: 400 }
      );
    }

    if (!tester.organization_id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bug Hunter organization ID is missing.",
        },
        { status: 400 }
      );
    }

    /*
     * Requested reward.
     * For your current demo, use 0.25 ETH.
     */
    const requestedRewardWei =
      ethers.parseEther("0.25");

    const encryptedEvidenceCID =
      "ipfs://";

    const rpcUrl = process.env.RPC_URL;

    const contractAddress =
      process.env.BUG_BOUNTY_ESCROW_ADDRESS;

    const verifierPrivateKey =
      process.env.TRUSTED_VERIFIER_PRIVATE_KEY;

    if (!rpcUrl) {
      throw new Error("RPC_URL is missing");
    }

    if (!contractAddress) {
      throw new Error(
        "BUG_BOUNTY_ESCROW_ADDRESS is missing"
      );
    }

    if (!verifierPrivateKey) {
      throw new Error(
        "TRUSTED_VERIFIER_PRIVATE_KEY is missing"
      );
    }

    const provider =
      new ethers.JsonRpcProvider(rpcUrl);

    const verifier =
      new ethers.Wallet(
        verifierPrivateKey,
        provider
      );

    const contract = new ethers.Contract(
      contractAddress,
      [
        "function authorizationNonces(address) view returns (uint256)"
      ],
      provider
    );

    const nonce =
      await contract.authorizationNonces(
        tester.wallet_address
      );

    const organizationId =
      tester.organization_id;

    const actionHash = ethers.solidityPackedKeccak256(
      [
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
      ],
      [
        bountyId,
        reportHash,
        ethers.keccak256(
          ethers.toUtf8Bytes(
            encryptedEvidenceCID
          )
        ),
        requestedRewardWei,
      ]
    );

    const authorization = {
      user: tester.wallet_address,
      role: 2,
      organizationId,
      action: 2,
      actionHash,
      nonce,
      deadline:
        BigInt(
          Math.floor(Date.now() / 1000) + 15 * 60
        ),
    };

    const domain = {
      name: "BugBountyEscrow",
      version: "1",
      chainId: 2026,
      verifyingContract: contractAddress,
    };

    const types = {
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

    const signature =
      await verifier.signTypedData(
        domain,
        types,
        authorization
      );

    return NextResponse.json({
      success: true,
      authorization,
      signature,
      encryptedEvidenceCID,
      requestedRewardWei:
        requestedRewardWei.toString(),
    });

  } catch (error) {
    console.error(
      "SUBMIT AUTHORIZATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create authorization",
      },
      { status: 500 }
    );
  }
}