import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { database } from "@/lib/database";

export const runtime = "nodejs";

type SessionPayload = {
  participantId?: string;
  walletAddress?: string;
  role?: string;
  organizationId?: string | null;
};

export async function GET(): Promise<NextResponse> {
  try {
    const sessionSecret =
      process.env.AUTH_SESSION_SECRET;

    if (!sessionSecret) {
      throw new Error(
        "AUTH_SESSION_SECRET is missing."
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
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const secretKey =
      new TextEncoder().encode(
        sessionSecret
      );

    let payload: SessionPayload;

    try {
      const verified =
        await jwtVerify(
          token,
          secretKey,
          {
            algorithms: ["HS256"],
          }
        );

      payload =
        verified.payload as SessionPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
        },
        { status: 401 }
      );
    }

    if (
      payload.role !== "tester" ||
      !payload.participantId ||
      !payload.walletAddress
    ) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
        },
        { status: 403 }
      );
    }

    const result =
      await database.query(
        `
        SELECT
          id,
          wallet_address,
          participant_type,
          organization_id,
          display_name,
          email,
          active,
          verified
        FROM participants
        WHERE id = $1
        LIMIT 1;
        `,
        [payload.participantId]
      );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const participant =
      result.rows[0];

    if (
      Number(participant.participant_type) !==
      2
    ) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
        },
        { status: 403 }
      );
    }

    if (!participant.active) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message:
            "This Bug Hunter account is inactive.",
        },
        { status: 403 }
      );
    }

    if (!participant.verified) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message:
            "This Bug Hunter account is not verified.",
        },
        { status: 403 }
      );
    }

    if (
      participant.wallet_address.toLowerCase() !==
      payload.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message:
            "The session wallet does not match the registered wallet.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      participant: {
        id: participant.id,
        walletAddress:
          participant.wallet_address,
        role: "tester",
        organizationId:
          participant.organization_id,
        display_name:
          participant.display_name,
        email:
          participant.email,
        active:
          participant.active,
        verified:
          participant.verified,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Tester session check failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
      },
      { status: 500 }
    );
  }
}