import "dotenv/config";

import { ethers } from "ethers";
import { Pool } from "pg";

type CompanyRow = {
  id: string;
  wallet_address: string;
  participant_type: number;
  company_name: string | null;
  active: boolean;
  verified: boolean;
  verified_at: Date | null;
};

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing from .env"
    );
  }

  const walletArgument =
    process.argv[2];

  if (!walletArgument) {
    throw new Error(
      "Provide the company wallet address.\n" +
        "Example: npx ts-node scripts/admin/verifyCompany.ts 0x123..."
    );
  }

  let walletAddress: string;

  try {
    walletAddress =
      ethers.getAddress(walletArgument);
  } catch {
    throw new Error(
      "The supplied wallet address is invalid."
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock the participant while approval
     * is being processed.
     */
    const companyResult =
      await client.query<CompanyRow>(
        `
        SELECT
          id,
          wallet_address,
          participant_type,
          company_name,
          active,
          verified,
          verified_at
        FROM participants
        WHERE LOWER(wallet_address) =
              LOWER($1)
        FOR UPDATE;
        `,
        [walletAddress]
      );

    if (companyResult.rowCount !== 1) {
      throw new Error(
        "Company account was not found."
      );
    }

    const company =
      companyResult.rows[0];

    if (company.participant_type !== 1) {
      throw new Error(
        "This participant is not a company."
      );
    }

    if (!company.active) {
      throw new Error(
        "This company account is inactive and cannot be verified."
      );
    }

    if (company.verified) {
      console.log(
        "Company is already verified."
      );

      console.log(
        `Company: ${company.company_name ?? "N/A"}`
      );

      console.log(
        `Wallet: ${company.wallet_address}`
      );

      await client.query("ROLLBACK");

      return;
    }

    const updateResult =
      await client.query<CompanyRow>(
        `
        UPDATE participants
        SET
          verified = TRUE,
          verified_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          wallet_address,
          participant_type,
          company_name,
          active,
          verified,
          verified_at;
        `,
        [company.id]
      );

    await client.query("COMMIT");

    const verifiedCompany =
      updateResult.rows[0];

    console.log("");
    console.log(
      "Company verified successfully."
    );

    console.log(
      `ID: ${verifiedCompany.id}`
    );

    console.log(
      `Company: ${verifiedCompany.company_name ?? "N/A"}`
    );

    console.log(
      `Wallet: ${verifiedCompany.wallet_address}`
    );

    console.log(
      `Active: ${verifiedCompany.active}`
    );

    console.log(
      `Verified: ${verifiedCompany.verified}`
    );

    console.log(
      `Verified At: ${verifiedCompany.verified_at}`
    );
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    "Company verification failed:",
    message
  );

  process.exitCode = 1;
});