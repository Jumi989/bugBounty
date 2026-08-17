import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { database } from "@/lib/database";

export const runtime = "nodejs";

type ParticipantRow = {
  id: string;
  wallet_address: string;
  participant_type: number;
  organization_id: string;
  active: boolean;
  verified: boolean;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
};

function unauthorized(
  message: string
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      authenticated: false,
      message,
    },
    {
      status: 401,
    }
  );

  /*
   * Remove an invalid/expired session cookie.
   */
  response.cookies.set(
    "bugbounty_session",
    "",
    {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    }
  );

  return response;
}

export async function GET():
Promise<NextResponse> {
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

    const sessionToken =
      cookieStore.get(
        "bugbounty_session"
      )?.value;

    if (!sessionToken) {
      return unauthorized(
        "No active company session was found."
      );
    }

    /*
     * Verify that the JWT was created by our backend
     * and has not expired or been modified.
     */
    let payload;

    try {
      const result =
        await jwtVerify(
          sessionToken,
          new TextEncoder().encode(
            sessionSecret
          ),
          {
            algorithms: ["HS256"],
          }
        );

      payload = result.payload;
    } catch {
      return unauthorized(
        "The company session is invalid or expired."
      );
    }

    const participantId =
      payload.participantId;

    const sessionWallet =
      payload.walletAddress;

    if (
      (
        typeof participantId !==
          "string" &&
        typeof participantId !==
          "number"
      ) ||
      typeof sessionWallet !== "string"
    ) {
      return unauthorized(
        "The company session is invalid."
      );
    }

    /*
     * IMPORTANT:
     *
     * We do not trust the JWT alone.
     *
     * Check PostgreSQL again so an administrator
     * can disable or unverify a company even if
     * that company still has an old session cookie.
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
          verified,
          display_name,
          company_name,
          email
        FROM participants
        WHERE id = $1
        LIMIT 1;
        `,
        [participantId]
      );

    if (
      participantResult.rowCount !== 1
    ) {
      return unauthorized(
        "The company account no longer exists."
      );
    }

    const participant =
      participantResult.rows[0];

    /*
     * participant_type:
     * 1 = Company
     */
    if (participant.participant_type !== 1) {
      return unauthorized(
        "This session does not belong to a company."
      );
    }

    if (!participant.active) {
      return unauthorized(
        "This company account is inactive."
      );
    }

    if (!participant.verified) {
      return unauthorized(
        "This company account is not verified."
      );
    }

    /*
     * Protect against a session containing a wallet
     * different from the participant record.
     */
    if (
      participant.wallet_address
        .toLowerCase() !==
      sessionWallet.toLowerCase()
    ) {
      return unauthorized(
        "The session wallet does not match the company account."
      );
    }

    return NextResponse.json({
      success: true,

      authenticated: true,

      participant: {
        id: participant.id,

        walletAddress:
          participant.wallet_address,

        role: "company",

        organizationId:
          participant.organization_id.trim(),

        companyName:
          participant.company_name,

        displayName:
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
    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    console.error(
      "Session verification failed:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        message:
          "The company session could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}