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

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: Context
) {
  try {
    // =====================================================
    // 1. AUTHENTICATE COMPANY
    // =====================================================

    const secret =
      process.env.AUTH_SESSION_SECRET;

    if (!secret) {
      throw new Error(
        "AUTH_SESSION_SECRET is missing"
      );
    }

    const cookieStore = await cookies();

    const token =
      cookieStore.get(
        "bugbounty_session"
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    let session: SessionPayload;

    try {
      const verified =
        await jwtVerify(
          token,
          new TextEncoder().encode(secret),
          {
            algorithms: ["HS256"],
          }
        );

      session =
        verified.payload as SessionPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session",
        },
        { status: 401 }
      );
    }

    if (
      session.role !== "company" &&
      session.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Not authenticated as a company.",
        },
        { status: 403 }
      );
    }

    if (!session.participantId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Company participant ID is missing.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 2. GET REPORT ID
    // =====================================================

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Report ID is missing.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 3. READ REQUEST
    // =====================================================

    const body = await request.json();

    const rewardAmountEth =
      String(body.rewardAmountEth || "").trim();

    if (!rewardAmountEth) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward amount is required.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 4. CONVERT REWARD TO WEI
    // =====================================================

    let rewardAmountWei: bigint;

    try {
      rewardAmountWei =
        ethers.parseEther(
          rewardAmountEth
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid ETH reward amount.",
        },
        { status: 400 }
      );
    }

    if (rewardAmountWei <= BigInt(0)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 5. LOAD REPORT + REAL ON-CHAIN BOUNTY ID
    //
    // vulnerability_reports.bounty_db_id
    //          ↓
    // bounties.id
    //          ↓
    // bounties.bounty_id
    //
    // bounties.bounty_id is the blockchain ID.
    // =====================================================

    const reportResult =
      await database.query(
        `
        SELECT
          vr.id,
          vr.bounty_db_id,
          vr.report_hash,
          vr.tester_wallet,
          vr.status,

          b.id AS bounty_database_id,
          b.bounty_id AS onchain_bounty_id,
          b.company_address,
          b.escrow_address

        FROM vulnerability_reports vr

        JOIN bounties b
          ON b.id = vr.bounty_db_id

        WHERE vr.id = $1

        LIMIT 1
        `,
        [id]
      );

    if (reportResult.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Report ${id} was not found.`,
        },
        { status: 404 }
      );
    }

    const report =
      reportResult.rows[0];

    console.log(
      "REWARD REPORT MAPPING:",
      {
        reportId: report.id,
        bountyDbId:
          report.bounty_db_id,
        bountiesId:
          report.bounty_database_id,
        onchainBountyId:
          report.onchain_bounty_id,
        testerWallet:
          report.tester_wallet,
        companyAddress:
          report.company_address,
      }
    );

    // =====================================================
    // 6. VALIDATE ON-CHAIN BOUNTY ID
    // =====================================================

    if (
      report.onchain_bounty_id ===
        null ||
      report.onchain_bounty_id ===
        undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "On-chain bounty ID is missing.",
        },
        { status: 400 }
      );
    }

    const onchainBountyId =
      BigInt(
        String(
          report.onchain_bounty_id
        )
      );

    console.log(
      "ON-CHAIN BOUNTY ID:",
      onchainBountyId.toString()
    );

    // =====================================================
    // 7. ENVIRONMENT
    // =====================================================

    const rpcUrl =
      process.env.RPC_URL;

    const contractAddress =
      process.env.BUG_BOUNTY_ESCROW_ADDRESS ||
      process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

    if (!rpcUrl) {
      throw new Error(
        "RPC_URL is missing"
      );
    }

    if (!contractAddress) {
      throw new Error(
        "BUG_BOUNTY_ESCROW_ADDRESS / NEXT_PUBLIC_ESCROW_ADDRESS is missing"
      );
    }

    // =====================================================
    // 8. PROVIDER
    // =====================================================

    const provider =
      new ethers.JsonRpcProvider(
        rpcUrl
      );

    // =====================================================
    // 9. ESCROW CONTRACT
    // =====================================================

    const escrow =
      new ethers.Contract(
        contractAddress,
        [
          "function payoutNonces(uint256) view returns (uint256)"
        ],
        provider
      );

    // =====================================================
    // 10. GET PAYOUT NONCE
    //
    // IMPORTANT:
    //
    // We use the ON-CHAIN bounty ID.
    //
    // This must be 6 for your current report,
    // NOT 22.
    // =====================================================

    console.log(
      "READING PAYOUT NONCE FOR BOUNTY:",
      onchainBountyId.toString()
    );

    let nonce: bigint;

    try {
      nonce =
        await escrow.payoutNonces(
          onchainBountyId
        );
    } catch (error) {
      console.error(
        "PAYOUT NONCE READ ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            `Could not read payout nonce for on-chain bounty ${onchainBountyId.toString()}. Check RPC_URL, escrow address, and Besu node.`,
        },
        { status: 500 }
      );
    }

    console.log(
      "PAYOUT NONCE:",
      nonce.toString()
    );

    // =====================================================
    // 11. TESTER WALLET
    // =====================================================

    const testerWallet =
      String(
        report.tester_wallet
      );

    if (
      !ethers.isAddress(
        testerWallet
      )
    ) {
      throw new Error(
        "Invalid tester wallet address."
      );
    }

    // =====================================================
    // 12. REPORT HASH
    // =====================================================

    const reportHash =
      String(
        report.report_hash
      );

    if (
      !/^0x[0-9a-fA-F]{64}$/.test(
        reportHash
      )
    ) {
      throw new Error(
        "Invalid report hash."
      );
    }

    // =====================================================
    // 13. DEADLINE
    // =====================================================

const deadline =
  BigInt(
    Math.floor(
      Date.now() / 1000
    ) + 24 * 60 * 60
  );

    // =====================================================
    // 14. REWARD AUTHORIZATION
    //
    // IMPORTANT:
    // This structure must match the Solidity
    // RewardApproval struct.
    // =====================================================

    const value = {
      bountyId:
        onchainBountyId.toString(),

      reportHash,

      tester: testerWallet,

      rewardAmount:
        rewardAmountWei.toString(),

      nonce:
        nonce.toString(),

      deadline:
        deadline.toString(),
    };

    // =====================================================
    // 15. EIP-712 DOMAIN
    // =====================================================

    const domain = {
      name: "BugBountyEscrow",
      version: "1",
      chainId: 2026,
      verifyingContract:
        contractAddress,
    };

    // =====================================================
    // 16. EIP-712 TYPES
    // =====================================================

    const types = {
      RewardApproval: [
        {
          name: "bountyId",
          type: "uint256",
        },
        {
          name: "reportHash",
          type: "bytes32",
        },
        {
          name: "tester",
          type: "address",
        },
        {
          name: "rewardAmount",
          type: "uint256",
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

    // =====================================================
    // 17. RETURN JSON
    // =====================================================

    return NextResponse.json({
      success: true,

      company: {
        walletAddress:
          report.company_address,
      },

      bounty: {
        databaseId:
          report.bounty_database_id,

        onchainId:
          onchainBountyId.toString(),

        escrowAddress:
          report.escrow_address ||
          contractAddress,
      },

      domain,

      types,

      value,

      rewardAmountWei:
        rewardAmountWei.toString(),

      nonce:
        nonce.toString(),

      deadline:
        deadline.toString(),
    });
  } catch (error) {
    console.error(
      "PREPARE REWARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to prepare reward.",
      },
      { status: 500 }
    );
  }
}