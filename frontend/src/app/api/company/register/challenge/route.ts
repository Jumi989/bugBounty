import { randomUUID } from "node:crypto";

import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";

/*
 * Validation rules for company registration.
 */
const registrationSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .min(1, "Wallet address is required"),

  companyName: z
    .string()
    .trim()
    .min(2, "Company name is required")
    .max(200),

  contactPersonName: z
    .string()
    .trim()
    .min(2, "Contact person name is required")
    .max(150),

  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(320),

  website: z
    .string()
    .trim()
    .url("Website must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("")),
});

type ExistingWalletRow = {
  id: string;
};

type ExistingEmailRow = {
  id: string;
};

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const requestBody: unknown =
      await request.json();

    const validationResult =
      registrationSchema.safeParse(
        requestBody
      );

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REGISTRATION_DATA",
          message:
            "Some company registration information is invalid.",
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
      companyName,
      contactPersonName,
      email,
      website,
      description,
    } = validationResult.data;

    /*
     * Validate and checksum-normalize the
     * Ethereum wallet address.
     */
    let walletAddress: string;

    try {
      walletAddress = ethers.getAddress(
        validationResult.data.walletAddress
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_WALLET",
          message:
            "The supplied wallet address is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * A wallet can belong to only one participant.
     */
    const existingWallet =
      await database.query<ExistingWalletRow>(
        `
        SELECT id
        FROM participants
        WHERE LOWER(wallet_address) =
              LOWER($1)
        LIMIT 1;
        `,
        [walletAddress]
      );

    if (existingWallet.rowCount === 1) {
      return NextResponse.json(
        {
          success: false,
          code: "WALLET_ALREADY_REGISTERED",
          message:
            "This wallet already has an account. Please sign in instead.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Email must also remain unique.
     */
    const existingEmail =
      await database.query<ExistingEmailRow>(
        `
        SELECT id
        FROM participants
        WHERE email IS NOT NULL
          AND LOWER(email) = LOWER($1)
        LIMIT 1;
        `,
        [email]
      );

    if (existingEmail.rowCount === 1) {
      return NextResponse.json(
        {
          success: false,
          code: "EMAIL_ALREADY_REGISTERED",
          message:
            "This email address is already registered.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * We create a deterministic representation
     * of the registration form.
     *
     * Hashing an array avoids ambiguity about
     * property ordering in a JavaScript object.
     */
    const registrationPayload = JSON.stringify([
      walletAddress.toLowerCase(),
      companyName,
      contactPersonName,
      email.toLowerCase(),
      website ?? "",
      description ?? "",
    ]);

    const registrationPayloadHash =
      ethers.keccak256(
        ethers.toUtf8Bytes(
          registrationPayload
        )
      );

    const challengeId = randomUUID();

    const issuedAt = new Date();

    const expiresAt = new Date(
      issuedAt.getTime() +
        5 * 60 * 1_000
    );

    /*
     * We don't expose all company/profile
     * information inside MetaMask.
     *
     * Instead MetaMask signs the cryptographic
     * hash of those exact details.
     */
    const challengeMessage = [
      "Register Company - Bug Bounty Security Journal",
      "",
      "Sign this message to prove that you control the wallet used for this company registration.",
      "",
      `Wallet: ${walletAddress}`,
      `Company: ${companyName}`,
      `Registration Hash: ${registrationPayloadHash}`,
      `Challenge ID: ${challengeId}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`,
      "",
      "This signature does not create a blockchain transaction and does not cost gas.",
    ].join("\n");

    const client =
      await database.connect();

    try {
      await client.query("BEGIN");

      /*
       * Cancel previous unused registration
       * challenges for this wallet.
       */
      await client.query(
        `
        UPDATE company_registration_challenges
        SET used_at = NOW()
        WHERE LOWER(wallet_address) =
              LOWER($1)
          AND used_at IS NULL;
        `,
        [walletAddress]
      );

      await client.query(
        `
        INSERT INTO company_registration_challenges (
          id,
          wallet_address,
          registration_payload_hash,
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
          walletAddress.toLowerCase(),
          registrationPayloadHash,
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

        registrationPayloadHash,
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
      "Company registration challenge failed:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        code: "REGISTRATION_CHALLENGE_FAILED",
        message:
          "The company registration challenge could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}