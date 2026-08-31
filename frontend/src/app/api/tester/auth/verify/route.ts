import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ethers } from "ethers";
import { SignJWT } from "jose";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";

const verifySchema = z.object({
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
  organization_id: string | null;
  active: boolean;
  verified: boolean;
  username: string | null;
  email: string | null;
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
  const client = await database.connect();

  try {
    const body: unknown =
      await request.json();

    const validation =
      verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid verification request.",
        },
        { status: 400 }
      );
    }

    const {
      challengeId,
      walletAddress: submittedWallet,
      signature,
    } = validation.data;

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
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const result =
      await client.query<ChallengeRow>(
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
          participants.username,
          participants.email
        FROM login_challenges
        INNER JOIN participants
          ON participants.id =
             login_challenges.participant_id
        WHERE login_challenges.id = $1
        FOR UPDATE;
        `,
        [challengeId]
      );

    if (result.rowCount !== 1) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "The login challenge was not found.",
        },
        { status: 404 }
      );
    }

    const challenge = result.rows[0];

    if (
      Number(challenge.participant_type) !== 2
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "This login challenge is not for a Bug Hunter.",
        },
        { status: 403 }
      );
    }

    if (challenge.used_at !== null) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "This login challenge has already been used.",
        },
        { status: 409 }
      );
    }

    if (
      new Date(challenge.expires_at).getTime() <=
      Date.now()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "This login challenge has expired.",
        },
        { status: 410 }
      );
    }

    if (
      challenge.wallet_address.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "The wallet does not match this challenge.",
        },
        { status: 403 }
      );
    }

    if (!challenge.active) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "This Bug Hunter account is inactive.",
        },
        { status: 403 }
      );
    }

    if (!challenge.verified) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "This Bug Hunter account is not verified.",
        },
        { status: 403 }
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
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "The wallet signature is invalid.",
        },
        { status: 401 }
      );
    }

    if (
      recoveredAddress.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "The signature was created by a different wallet.",
        },
        { status: 401 }
      );
    }

    const updateResult =
      await client.query(
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
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            "The login challenge could not be consumed.",
        },
        { status: 409 }
      );
    }

    await client.query("COMMIT");

    const sessionSecret =
      requireEnvironmentVariable(
        "AUTH_SESSION_SECRET"
      );

    const secretKey =
      new TextEncoder().encode(
        sessionSecret
      );

    const sessionToken =
      await new SignJWT({
        participantId:
          challenge.participant_id,
        walletAddress,
        role: "tester",
        organizationId:
          challenge.organization_id,
      })
        .setProtectedHeader({
          alg: "HS256",
        })
        .setSubject(
          challenge.participant_id
        )
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(secretKey);

    const cookieStore =
      await cookies();

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
      message:
        "Bug Hunter login successful.",
      participant: {
        id: challenge.participant_id,
        walletAddress,
        role: "tester",
        organizationId:
          challenge.organization_id,
        username:
          challenge.username,
        email:
          challenge.email,
      },
    });
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure.
    }

    console.error(
      "Tester wallet verification failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "The Bug Hunter login could not be verified.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}