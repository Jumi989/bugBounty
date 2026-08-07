import { randomBytes } from "node:crypto";

import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";

const registrationVerifySchema = z.object({
  challengeId: z.string().uuid(),

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

  signature: z
    .string()
    .trim()
    .min(1, "Wallet signature is required"),
});

type RegistrationChallengeRow = {
  id: string;
  wallet_address: string;
  registration_payload_hash: string;
  challenge_message: string;
  expires_at: Date;
  used_at: Date | null;
};

export async function POST(
  request: Request
): Promise<NextResponse> {
  const client = await database.connect();

  try {
    const requestBody: unknown =
      await request.json();

    const validationResult =
      registrationVerifySchema.safeParse(
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
      challengeId,
      companyName,
      contactPersonName,
      email,
      website,
      description,
      signature,
    } = validationResult.data;

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
     * Rebuild EXACTLY the same payload used when
     * the registration challenge was created.
     */
    const registrationPayload =
      JSON.stringify([
        walletAddress.toLowerCase(),
        companyName,
        contactPersonName,
        email.toLowerCase(),
        website ?? "",
        description ?? "",
      ]);

    const calculatedPayloadHash =
      ethers.keccak256(
        ethers.toUtf8Bytes(
          registrationPayload
        )
      );

    await client.query("BEGIN");

    /*
     * FOR UPDATE locks this challenge row until the
     * transaction finishes.
     *
     * This helps prevent two requests from consuming
     * the same challenge simultaneously.
     */
    const challengeResult =
      await client.query<RegistrationChallengeRow>(
        `
        SELECT
          id,
          wallet_address,
          registration_payload_hash,
          challenge_message,
          expires_at,
          used_at
        FROM company_registration_challenges
        WHERE id = $1
        FOR UPDATE;
        `,
        [challengeId]
      );

    if (challengeResult.rowCount !== 1) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "CHALLENGE_NOT_FOUND",
          message:
            "The company registration challenge was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const challenge =
      challengeResult.rows[0];

    /*
     * Challenge must belong to the same wallet.
     */
    if (
      challenge.wallet_address.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "WALLET_MISMATCH",
          message:
            "This registration challenge belongs to another wallet.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Prevent replay.
     */
    if (challenge.used_at !== null) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "CHALLENGE_ALREADY_USED",
          message:
            "This company registration challenge has already been used.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Reject expired challenges.
     */
    if (
      new Date(challenge.expires_at).getTime() <=
      Date.now()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "CHALLENGE_EXPIRED",
          message:
            "This company registration challenge has expired. Please try again.",
        },
        {
          status: 410,
        }
      );
    }

    /*
     * Make sure the registration information has
     * not changed after MetaMask challenge creation.
     */
    if (
      challenge.registration_payload_hash
        .toLowerCase() !==
      calculatedPayloadHash.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "REGISTRATION_DATA_CHANGED",
          message:
            "The company registration information changed after the challenge was created.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Recover the wallet that actually produced
     * the MetaMask signature.
     */
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
          code: "INVALID_SIGNATURE",
          message:
            "The MetaMask signature is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * The signer MUST be the wallet being registered.
     */
    if (
      recoveredAddress.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          code: "SIGNER_MISMATCH",
          message:
            "The registration was signed by a different wallet.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Check again immediately before INSERT.
     *
     * Even though the challenge endpoint checked this,
     * another registration could have happened between
     * challenge creation and signature verification.
     */
    const existingWallet =
      await client.query(
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
      await client.query("ROLLBACK");

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

    const existingEmail =
      await client.query(
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
      await client.query("ROLLBACK");

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
     * Organization ID is generated by the backend.
     *
     * The company cannot choose its own organization ID.
     */
    const organizationId =
      ethers.hexlify(
        randomBytes(32)
      );

    /*
     * participant_type:
     *
     * 1 = Company
     * 2 = Tester
     *
     * New companies are active but NOT verified.
     */
    const participantResult =
      await client.query(
        `
        INSERT INTO participants (
          wallet_address,
          participant_type,
          organization_id,
          active,
          verified,
          validator_candidate,
          display_name,
          email,
          company_name,
          profile_data,
          verified_at
        )
        VALUES (
          $1,
          1,
          $2,
          TRUE,
          FALSE,
          FALSE,
          $3,
          $4,
          $5,
          $6::jsonb,
          NULL
        )
        RETURNING
          id,
          wallet_address,
          participant_type,
          organization_id,
          active,
          verified,
          display_name,
          email,
          company_name;
        `,
        [
          walletAddress.toLowerCase(),
          organizationId,
          contactPersonName,
          email.toLowerCase(),
          companyName,
          JSON.stringify({
            website: website ?? "",
            description:
              description ?? "",
          }),
        ]
      );

    /*
     * Consume the challenge only after participant
     * creation succeeds.
     */
    await client.query(
      `
      UPDATE company_registration_challenges
      SET used_at = NOW()
      WHERE id = $1;
      `,
      [challengeId]
    );

    await client.query("COMMIT");

    const participant =
      participantResult.rows[0];

    return NextResponse.json(
      {
        success: true,

        message:
          "Company registration submitted successfully. Your account is awaiting administrator verification.",

        participant: {
          id: participant.id,
          walletAddress:
            participant.wallet_address,
          role: "company",
          organizationId:
            participant.organization_id.trim(),
          active:
            participant.active,
          verified:
            participant.verified,
          contactPersonName:
            participant.display_name,
          email:
            participant.email,
          companyName:
            participant.company_name,
        },

        verificationStatus:
          "pending",
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    /*
     * Make sure an unfinished transaction does
     * not remain open.
     */
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure.
    }

    const databaseError =
      error as {
        code?: string;
        constraint?: string;
      };

    /*
     * PostgreSQL unique-constraint violation.
     *
     * This also protects us against race conditions.
     */
    if (databaseError.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          code: "REGISTRATION_CONFLICT",
          message:
            "The wallet or email address is already registered.",
        },
        {
          status: 409,
        }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    console.error(
      "Company registration verification failed:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        code: "REGISTRATION_FAILED",
        message:
          "The company registration could not be completed.",
      },
      {
        status: 500,
      }
    );
  } finally {
    client.release();
  }
}