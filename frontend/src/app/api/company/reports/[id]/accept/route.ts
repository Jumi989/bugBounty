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

const REWARD_APPROVAL_TYPES = {
  RewardApproval: [
    { name: "bountyId", type: "uint256" },
    { name: "reportHash", type: "bytes32" },
    { name: "tester", type: "address" },
    { name: "rewardAmount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};


async function getCompanySession() {
  const secret =
    process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET is missing"
    );
  }

  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      "bugbounty_session"
    )?.value;

  if (!token) {
    return null;
  }

  try {
    const verified =
      await jwtVerify(
        token,
        new TextEncoder().encode(
          secret
        ),
        {
          algorithms: ["HS256"],
        }
      );

    const session =
      verified.payload as SessionPayload;

    if (
      session.role !== "company" ||
      !session.participantId ||
      !session.walletAddress
    ) {
      return null;
    }

    const result =
      await database.query(
        `
        SELECT
          id,
          wallet_address,
          participant_type,
          active,
          verified
        FROM participants
        WHERE id = $1
        LIMIT 1
        `,
        [session.participantId]
      );

    if (result.rowCount !== 1) {
      return null;
    }

    const company =
      result.rows[0];

    if (
      Number(company.participant_type) !== 1 ||
      !company.active ||
      !company.verified
    ) {
      return null;
    }

    if (
      company.wallet_address.toLowerCase() !==
      session.walletAddress.toLowerCase()
    ) {
      return null;
    }

    return {
      id: String(company.id),
      walletAddress:
        ethers.getAddress(
          company.wallet_address
        ),
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // =====================================================
    // 1. AUTHENTICATE COMPANY
    // =====================================================

    const company =
      await getCompanySession();

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not authenticated as a verified company.",
        },
        { status: 401 }
      );
    }

    const { id } =
      await context.params;

    const reportId =
      Number(id);

    if (
      !Number.isInteger(reportId) ||
      reportId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid report ID.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 2. READ REQUEST
    // =====================================================

    const body =
      await request.json();

    const rewardAmountWei =
      String(
        body.rewardAmountWei ?? ""
      );

    const nonce =
      String(
        body.nonce ?? ""
      );

    const deadline =
      String(
        body.deadline ?? ""
      );

    const signature =
      String(
        body.signature ?? ""
      );

    if (
      !rewardAmountWei ||
      !nonce ||
      !deadline ||
      !signature
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing reward approval information.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 3. NORMALIZE NUMERIC VALUES
    // =====================================================

    let rewardWei: bigint;
    let approvalNonce: bigint;
    let approvalDeadline: bigint;

    try {
      rewardWei =
        BigInt(
          rewardAmountWei
        );

      approvalNonce =
        BigInt(nonce);

      approvalDeadline =
        BigInt(deadline);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid reward approval values.",
        },
        { status: 400 }
      );
    }

    if (rewardWei <= 0n) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward must be greater than zero.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 4. LOAD REPORT
    // =====================================================

    const result =
      await database.query(
        `
        SELECT
          vr.id,
          vr.status,
          vr.report_hash,
          vr.tester_wallet,

          b.bounty_id,
          b.company_address,
          b.available_escrow_wei

        FROM vulnerability_reports vr

        JOIN bounties b
          ON b.id = vr.bounty_db_id

        WHERE vr.id = $1
          AND LOWER(b.company_address) =
              LOWER($2)

        LIMIT 1
        `,
        [
          reportId,
          company.walletAddress,
        ]
      );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Report not found.",
        },
        { status: 404 }
      );
    }

    const report =
      result.rows[0];

    if (
      report.status !==
      "submitted"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Cannot accept report because its status is ${report.status}.`,
        },
        { status: 409 }
      );
    }

    const bountyId =
      BigInt(
        String(
          report.bounty_id
        )
      );

    const reportHash =
      ethers.hexlify(
        report.report_hash
      );

    const tester =
      ethers.getAddress(
        report.tester_wallet
      );

    // =====================================================
    // 5. VERIFY SIGNATURE
    // =====================================================

    const escrowAddress =
      process.env.BUG_BOUNTY_ESCROW_ADDRESS;

    const rpcUrl =
      process.env.RPC_URL;

    if (!escrowAddress) {
      throw new Error(
        "BUG_BOUNTY_ESCROW_ADDRESS is missing"
      );
    }

    if (!rpcUrl) {
      throw new Error(
        "RPC_URL is missing"
      );
    }

    const provider =
      new ethers.JsonRpcProvider(
        rpcUrl
      );

    const network =
      await provider.getNetwork();

    const domain = {
      name: "BugBountyEscrow",
      version: "1",
      chainId:
        Number(network.chainId),
      verifyingContract:
        ethers.getAddress(
          escrowAddress
        ),
    };

    const value = {
      bountyId:
        bountyId.toString(),

      reportHash,

      tester,

      rewardAmount:
        rewardWei.toString(),

      nonce:
        approvalNonce.toString(),

      deadline:
        approvalDeadline.toString(),
    };

    let recovered: string;

    try {
      recovered =
        ethers.verifyTypedData(
          domain,
          REWARD_APPROVAL_TYPES,
          value,
          signature
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid company reward signature.",
        },
        { status: 400 }
      );
    }

    if (
      recovered.toLowerCase() !==
      company.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward signature does not belong to the bounty-owning company.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 6. VERIFY LIVE CONTRACT STATE
    // =====================================================

    const escrow =
      new ethers.Contract(
        ethers.getAddress(
          escrowAddress
        ),
        [
          "function payoutNonces(uint256) view returns (uint256)",
          "function getBounty(uint256) view returns (tuple(address company,bytes32 companyOrganizationId,bytes32 metadataHash,string metadataCID,uint256 totalEscrow,uint256 availableEscrow,uint64 startTime,uint64 endTime,uint64 refundAvailableAt,uint8 status))",
        ],
        provider
      );

    const liveNonce =
      await escrow.payoutNonces(
        bountyId
      );

    if (
      liveNonce !==
      approvalNonce
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Reward approval nonce is stale. ` +
            `Expected ${liveNonce.toString()}, received ${approvalNonce.toString()}.`,
        },
        { status: 409 }
      );
    }

    const bounty =
      await escrow.getBounty(
        bountyId
      );

    const onchainCompany =
      ethers.getAddress(
        bounty.company
      );

    if (
      onchainCompany.toLowerCase() !==
      company.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Connected company is not the bounty owner.",
        },
        { status: 403 }
      );
    }

    const liveEscrow =
      BigInt(
        bounty.availableEscrow
      );

    if (
      rewardWei >
      liveEscrow
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward exceeds current on-chain escrow.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 7. DEADLINE CHECK
    // =====================================================

    const now =
      BigInt(
        Math.floor(
          Date.now() / 1000
        )
      );

    if (
      now >
      approvalDeadline
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Reward approval has expired.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 8. STORE ACCEPTED REWARD
    //
    // NO BLOCKCHAIN TRANSACTION HERE.
    // =====================================================

    const updated =
      await database.query(
        `
        UPDATE vulnerability_reports

        SET
          status = 'accepted',
          approved_reward_wei = $2,
          payout_nonce = $3,
          payout_deadline =
            TO_TIMESTAMP($4),
          company_signature = $5,
          reviewed_at = NOW(),
          updated_at = NOW()

        WHERE id = $1
          AND status = 'submitted'

        RETURNING id
        `,
        [
          reportId,
          rewardWei.toString(),
          approvalNonce.toString(),
          approvalDeadline.toString(),
          signature,
        ]
      );

    if (updated.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Report was already reviewed.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Reward approved successfully.",
      reportId,
      status: "accepted",
      approvedRewardWei:
        rewardWei.toString(),
      payoutNonce:
        approvalNonce.toString(),
      payoutDeadline:
        approvalDeadline.toString(),
    });
  } catch (error) {
    console.error(
      "ACCEPT REWARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to accept reward.",
      },
      { status: 500 }
    );
  }
}