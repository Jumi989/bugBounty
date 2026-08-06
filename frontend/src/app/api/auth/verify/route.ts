import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { SignJWT } from "jose";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";

const verifyRequestSchema = z.object({
  challengeId: z.string().uuid(),
  walletAddress: z.string().trim().min(1),
  signature: z.string().trim().min(1),
});

type ChallengeRow = {
  id: string;
  participant_id: string;
  wallet_address: string;
  challenge_message: string;
  expires_at: Date;
  used_at: Date | null;

  participant_type: number;
  organization_id: string;
  active: boolean;
  verified: boolean;
  display_name: string | null;
  company_name: string | null;
};

function requireEnvironmentVariable(
  name: string
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from frontend/.env.local`
    );
  }

  return value;
}

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const requestBody: unknown =
      await request.json();

    const validationResult =
      verifyRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid verification request.",
          errors:
            validationResult.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    const {
      challengeId,
      walletAddress: submittedWallet,
      signature,
    } = validationResult.data;

    let walletAddress: string;

    try {
      walletAddress =
        ethers.getAddress(submittedWallet);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid wallet address.",
        },
        {
          status: 400,
        }
      );
    }

    const challengeResult =
      await database.query<ChallengeRow>(
        `
        SELECT
          login_challenges.id,
          login_challenges.participant_id,
          login_challenges.wallet_address,
          login_challenges.challenge_message,
          login_challenges.expires_at,
          login_challenges.used_at,

          participants.participant_type,
          participants.organization_id,
          participants.active,
          participants.verified,
          participants.display_name,
          participants.company_name
        FROM login_challenges
        INNER JOIN participants
          ON participants.id =
             login_challenges.participant_id
        WHERE login_challenges.id = $1
        LIMIT 1;
        `,
        [challengeId]
      );

    if (challengeResult.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The login challenge was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const challenge =
      challengeResult.rows[0];

    if (challenge.used_at !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This login challenge has already been used.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      new Date(challenge.expires_at).getTime() <=
      Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This login challenge has expired.",
        },
        {
          status: 410,
        }
      );
    }

    if (
      challenge.wallet_address.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The wallet does not match this challenge.",
        },
        {
          status: 403,
        }
      );
    }

    const companyRole = 1;

    if (
      Number(challenge.participant_type) !==
      companyRole
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This participant is not a company.",
        },
        {
          status: 403,
        }
      );
    }

    if (!challenge.active) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This company account is inactive.",
        },
        {
          status: 403,
        }
      );
    }

    if (!challenge.verified) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This company account is not verified.",
        },
        {
          status: 403,
        }
      );
    }

    let recoveredAddress: string;

    try {
      recoveredAddress =
        ethers.verifyMessage(
          challenge.challenge_message,
          signature
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "The wallet signature is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      recoveredAddress.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The signature was created by a different wallet.",
        },
        {
          status: 401,
        }
      );
    }

    const client = await database.connect();

    try {
      await client.query("BEGIN");

      const updateResult = await client.query(
        `
        UPDATE login_challenges
        SET used_at = NOW()
        WHERE id = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING id;
        `,
        [challengeId]
      );

      if (updateResult.rowCount !== 1) {
        throw new Error(
          "The challenge could not be consumed."
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const sessionSecret =
      requireEnvironmentVariable(
        "AUTH_SESSION_SECRET"
      );

    const secretKey = new TextEncoder().encode(
      sessionSecret
    );

    const sessionToken = await new SignJWT({
      participantId:
        challenge.participant_id,
      walletAddress,
      role: "company",
      organizationId:
        challenge.organization_id.trim(),
    })
      .setProtectedHeader({
        alg: "HS256",
      })
      .setSubject(
        challenge.participant_id.toString()
      )
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secretKey);

    const cookieStore = await cookies();

    cookieStore.set(
      "bugbounty_session",
      sessionToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 2 * 60 * 60,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Company login successful.",
      participant: {
        walletAddress,
        role: "company",
        displayName:
          challenge.company_name ??
          challenge.display_name ??
          "Verified Company",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    console.error(
      "Wallet verification failed:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "The wallet login could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}