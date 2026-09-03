import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { database } from "@/lib/database";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

type SessionPayload = {
  participantId?: string;
  walletAddress?: string;
  role?: string;
};

export async function GET() {
  try {
    // =====================================================
    // 1. AUTHENTICATION
    // =====================================================

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
      !session.participantId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Not authenticated as Bug Hunter",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 2. GET TESTER REPORTS
    // =====================================================

    /*
     * IMPORTANT:
     *
     * vulnerability_reports.bounty_db_id
     * is the DATABASE bounty ID.
     *
     * bounties.bounty_id
     * is the ON-CHAIN bounty ID.
     *
     * The blockchain claimReward() function needs
     * bounties.bounty_id.
     */

    const result = await database.query(
  `
  SELECT
    vr.id,
    vr.bounty_db_id,
    b.bounty_id AS bounty_id,
    vr.tester_wallet,
    vr.title,
    vr.severity,
    vr.status,
    vr.report_hash,
    vr.approved_reward_wei::text,
    vr.payout_nonce::text,
    CASE
      WHEN vr.payout_deadline IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM vr.payout_deadline)::bigint::text
    END AS payout_deadline,
    vr.company_signature,
    vr.claim_transaction_hash,
    vr.created_at,
    vr.updated_at
  FROM vulnerability_reports vr
  JOIN bounties b
    ON b.id = vr.bounty_db_id
  WHERE vr.tester_id = $1
  ORDER BY vr.created_at DESC
  `,
  [session.participantId]
);

    // =====================================================
    // 3. RETURN JSON
    // =====================================================

    return NextResponse.json({
      success: true,
      reports: result.rows,
    });

  } catch (error) {
    console.error(
      "GET TESTER REPORTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load tester reports",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const verified =
      await jwtVerify(
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
          message:
            "Not authenticated as Bug Hunter",
        },
        { status: 403 }
      );
    }

    const testerResult =
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

    if (testerResult.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bug Hunter account was not found."
        },
        { status: 404 }
      );
    }

    const tester =
      testerResult.rows[0];

    if (
      Number(tester.participant_type) !== 2 ||
      !tester.active ||
      !tester.verified
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bug Hunter account is not active and verified."
        },
        { status: 403 }
      );
    }

    if (
      tester.wallet_address.toLowerCase() !==
      session.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session wallet does not match the Bug Hunter wallet."
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const {
      bountyId,
      title,
      severity,
      description,
      stepsToReproduce,
      evidenceUrl,
    } = body;

    if (
      !bountyId ||
      !title ||
      !severity ||
      !description ||
      !stepsToReproduce
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing required report information"
        },
        { status: 400 }
      );
    }

    const bountyResult =
      await database.query(
        `
        SELECT
          b.id AS bounty_db_id,
          b.bounty_id AS onchain_bounty_id,
          b.company_address,
          b.chain_id,
          b.escrow_address,
          b.start_time,
          b.end_time
        FROM bounty_metadata m
        JOIN bounties b
          ON b.id = m.bounty_id
        WHERE m.id = $1
        LIMIT 1
        `,
        [bountyId]
      );

    if (bountyResult.rowCount !== 1) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Bounty " +
        String(bountyId) +
        " was not found."
    },
    { status: 404 }
  );
}

    const bounty =
      bountyResult.rows[0];

    const bountyDbId =
      String(bounty.bounty_db_id);

    const onchainBountyId =
      String(
        bounty.onchain_bounty_id
      );

    if (
      bounty.company_address.toLowerCase() ===
      tester.wallet_address.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A company cannot submit a report to its own bounty."
        },
        { status: 403 }
      );
    }

    const canonicalReport =
      JSON.stringify({
        bountyId: onchainBountyId,
        title,
        severity,
        description,
        stepsToReproduce,
        evidenceUrl:
          evidenceUrl || null,
        testerId:
          String(tester.id),
        testerWallet:
          tester.wallet_address,
      });

    const reportHash =
      "0x" +
      createHash("sha256")
  .update(canonicalReport)
  .digest("hex");


    const result =
      await database.query(
        `
        INSERT INTO vulnerability_reports
        (
          bounty_db_id,
          tester_id,
          tester_wallet,
          title,
          severity,
          description,
          steps_to_reproduce,
          evidence_url,
          report_hash,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'submitted'
        )
        RETURNING *
        `,
        [
          bountyDbId,
          tester.id,
          tester.wallet_address,
          title,
          severity,
          description,
          stepsToReproduce,
          evidenceUrl || null,
          reportHash,
        ]
      );

    return NextResponse.json({
      success: true,
      report: {
        ...result.rows[0],
        onchain_bounty_id:
          onchainBountyId,
      },
    });
  } catch (error) {
    console.error(
      "REPORT CREATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create vulnerability report",
      },
      { status: 500 }
    );
  }
}