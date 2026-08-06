import { randomUUID } from "node:crypto";

import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { database } from "@/lib/database";

/*
 * PostgreSQL requires the Node.js runtime.
 * This route must not run in the Edge runtime.
 */
export const runtime = "nodejs";

const challengeRequestSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .min(1, "Wallet address is required"),
});

type ParticipantRow = {
  id: string;
  wallet_address: string;
  participant_type: number;
  organization_id: string;
  active: boolean;
  verified: boolean;
  display_name: string | null;
  company_name: string | null;
};

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const requestBody: unknown =
      await request.json();

    const validationResult =
      challengeRequestSchema.safeParse(
        requestBody
      );

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data.",
          errors:
            validationResult.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    const submittedWallet =
      validationResult.data.walletAddress;

    /*
     * ethers.getAddress performs two jobs:
     *
     * 1. Verifies that this is a valid Ethereum address.
     * 2. Returns the checksum-formatted address.
     */
    let walletAddress: string;

    try {
      walletAddress =
        ethers.getAddress(submittedWallet);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "The supplied wallet address is invalid.",
        },
        {
          status: 400,
        }
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
          display_name,
          company_name
        FROM participants
        WHERE LOWER(wallet_address) =
              LOWER($1)
        LIMIT 1;
        `,
        [walletAddress]
      );

    if (participantResult.rowCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No participant profile was found for this wallet.",
        },
        {
          status: 404,
        }
      );
    }

    const participant =
      participantResult.rows[0];

    /*
     * Participant role values:
     *
     * 1 = Company
     * 2 = Tester
     */
    const companyRole = 1;

    if (
      Number(participant.participant_type) !==
      companyRole
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This wallet is not registered as a company.",
        },
        {
          status: 403,
        }
      );
    }

    if (!participant.active) {
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

    if (!participant.verified) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This company account has not been verified.",
        },
        {
          status: 403,
        }
      );
    }

    const challengeId = randomUUID();

    const issuedAt = new Date();

    const expiresAt = new Date(
      issuedAt.getTime() + 5 * 60 * 1_000
    );

    const companyDisplayName =
      participant.company_name ??
      participant.display_name ??
      "Verified Company";

    /*
     * The challenge ID acts as a unique nonce.
     *
     * A nonce is a one-time value that prevents
     * an old signature from being reused.
     */
    const challengeMessage = [
      "Sign in to Bug Bounty Security Journal",
      "",
      "This signature proves that you control the connected wallet.",
      "It does not create a blockchain transaction and does not cost gas.",
      "",
      `Company: ${companyDisplayName}`,
      `Wallet: ${walletAddress}`,
      `Challenge ID: ${challengeId}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`,
    ].join("\n");

    const client = await database.connect();

    try {
      await client.query("BEGIN");

      /*
       * Mark previous unused challenges for this wallet
       * as used. Only the newest challenge should remain
       * valid.
       */
      await client.query(
        `
        UPDATE login_challenges
        SET used_at = NOW()
        WHERE LOWER(wallet_address) =
              LOWER($1)
          AND used_at IS NULL;
        `,
        [walletAddress]
      );

      await client.query(
        `
        INSERT INTO login_challenges (
          id,
          participant_id,
          wallet_address,
          challenge_message,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        );
        `,
        [
          challengeId,
          participant.id,
          walletAddress.toLowerCase(),
          challengeMessage,
          expiresAt,
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json(
      {
        success: true,
        challenge: {
          id: challengeId,
          message: challengeMessage,
          expiresAt:
            expiresAt.toISOString(),
        },
        participant: {
          walletAddress,
          role: "company",
          displayName:
            companyDisplayName,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    console.error(
      "Challenge creation failed:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "The login challenge could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}