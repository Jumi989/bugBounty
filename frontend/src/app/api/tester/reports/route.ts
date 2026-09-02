import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { database } from "@/lib/database";

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
        vr.title,
        vr.severity,
        vr.status,

        vr.bounty_db_id,

        b.bounty_id AS bounty_id,

        vr.report_hash,

        vr.approved_reward_wei,

        vr.payout_nonce,
        vr.payout_deadline,
        vr.company_signature

      FROM vulnerability_reports vr

      INNER JOIN bounties b
        ON b.id = vr.bounty_db_id

      WHERE vr.tester_id = $1

      ORDER BY vr.id DESC
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