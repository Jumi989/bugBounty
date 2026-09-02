import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import crypto from "crypto";

import { database } from "@/lib/database";

export const runtime = "nodejs";

type SessionPayload = {
  participantId?: string;
  walletAddress?: string;
  role?: string;
  organizationId?: string | null;
};

async function getAuthenticatedTester() {
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("AUTH_SESSION_SECRET is missing.");
  }

  const cookieStore = await cookies();

  const token = cookieStore.get("bugbounty_session")?.value;

  if (!token) {
    return null;
  }

  const secretKey = new TextEncoder().encode(sessionSecret);

  let payload: SessionPayload;

  try {
    const verified = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    payload = verified.payload as SessionPayload;
  } catch {
    return null;
  }

  if (
    payload.role !== "tester" ||
    !payload.participantId ||
    !payload.walletAddress
  ) {
    return null;
  }

  const result = await database.query(
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
    [payload.participantId]
  );

  if (result.rowCount !== 1) {
    return null;
  }

  const participant = result.rows[0];

  if (Number(participant.participant_type) !== 2) {
    return null;
  }

  if (!participant.active || !participant.verified) {
    return null;
  }

  if (
    participant.wallet_address.toLowerCase() !==
    payload.walletAddress.toLowerCase()
  ) {
    return null;
  }

  return {
    id: String(participant.id),
    walletAddress: participant.wallet_address,
  };
}


/* =========================================================
   GET
   Load reports belonging to the currently authenticated
   Bug Hunter.
   ========================================================= */

export async function GET() {
  try {
    const tester = await getAuthenticatedTester();

    if (!tester) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "You are not authenticated as a Bug Hunter.",
        },
        { status: 401 }
      );
    }

    const result = await database.query(
      `
SELECT
  id,
  bounty_db_id,
  title,
  severity,
  status,
  report_hash,
  approved_reward_wei,
  payout_nonce,
  payout_deadline,
  company_signature,
  claim_transaction_hash,
  created_at,
  updated_at
FROM vulnerability_reports
WHERE tester_id = $1
ORDER BY created_at DESC
      `,
      [tester.id]
    );

    console.log(
      "TESTER REPORTS:",
      tester.id,
      result.rows
    );

    return NextResponse.json({
      success: true,
      reports: result.rows,
    });
  } catch (error) {
    console.error("REPORT LIST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load vulnerability reports",
      },
      { status: 500 }
    );
  }
}


/* =========================================================
   POST
   Create a vulnerability report.

   IMPORTANT:
   testerId and testerWallet are NOT trusted from the browser.
   They come from the authenticated session.
   ========================================================= */

export async function POST(request: Request) {
  try {
    const tester = await getAuthenticatedTester();

    if (!tester) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "You are not authenticated as a Bug Hunter.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

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
          message: "Missing required report information",
        },
        { status: 400 }
      );
    }

    const canonicalReport = JSON.stringify({
      bountyId,
      title,
      severity,
      description,
      stepsToReproduce,
      evidenceUrl: evidenceUrl || null,
      testerId: tester.id,
      testerWallet: tester.walletAddress,
    });

    const reportHash =
      "0x" +
      crypto
        .createHash("sha256")
        .update(canonicalReport)
        .digest("hex");

    const result = await database.query(
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
        bountyId,
        tester.id,
        tester.walletAddress,
        title,
        severity,
        description,
        stepsToReproduce,
        evidenceUrl || null,
        reportHash,
      ]
    );

    console.log(
      "REPORT CREATED:",
      result.rows[0]
    );

    return NextResponse.json({
      success: true,
      report: result.rows[0],
    });
  } catch (error) {
    console.error("REPORT CREATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create vulnerability report",
      },
      { status: 500 }
    );
  }
}