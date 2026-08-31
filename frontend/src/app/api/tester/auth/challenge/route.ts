import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";

const requestSchema = z.object({
  walletAddress: z.string().trim().min(1),
});

type ParticipantRow = {
  id: string;
  wallet_address: string;
  participant_type: number;
  organization_id: string | null;
  active: boolean;
  verified: boolean;
  username: string | null;
};

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    const validation =
      requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid wallet address.",
        },
        { status: 400 }
      );
    }

    let walletAddress: string;

    try {
      walletAddress = ethers.getAddress(
        validation.data.walletAddress
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid wallet address.",
        },
        { status: 400 }
      );
    }

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
          username
        FROM participants
        WHERE LOWER(wallet_address) = LOWER($1)
          AND participant_type = 2
        LIMIT 1;
        `,
        [walletAddress]
      );

    if (participantResult.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          code: "TESTER_NOT_REGISTERED",
          message:
            "No Bug Hunter account is registered with this wallet.",
        },
        { status: 404 }
      );
    }

    const participant =
      participantResult.rows[0];

    if (!participant.active) {
      return NextResponse.json(
        {
          success: false,
          code: "TESTER_INACTIVE",
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
          code: "TESTER_NOT_VERIFIED",
          message:
            "This Bug Hunter account is not verified.",
        },
        { status: 403 }
      );
    }

    const challengeId = randomUUID();

    const issuedAt = new Date();

    const expiresAt =
      new Date(
        issuedAt.getTime() + 5 * 60 * 1000
      );

    const challengeMessage = [
      "Sign in to BugBounty",
      "",
      "This signature proves that you control the connected Bug Hunter wallet.",
      "It does not create a blockchain transaction and does not cost gas.",
      "",
      `Bug Hunter: ${participant.username ?? "Unknown"}`,
      `Wallet: ${walletAddress}`,
      `Challenge ID: ${challengeId}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`,
    ].join("\n");

    await database.query(
      `
      UPDATE login_challenges
      SET used_at = NOW()
      WHERE participant_id = $1
        AND used_at IS NULL;
      `,
      [participant.id]
    );

    await database.query(
      `
      INSERT INTO login_challenges (
        id,
        participant_id,
        wallet_address,
        challenge_message,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5);
      `,
      [
        challengeId,
        participant.id,
        walletAddress.toLowerCase(),
        challengeMessage,
        expiresAt,
      ]
    );

    return NextResponse.json({
      success: true,
      challenge: {
        id: challengeId,
        message: challengeMessage,
        walletAddress,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error(
      "Tester login challenge failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Could not create the Bug Hunter login challenge.",
      },
      { status: 500 }
    );
  }
}