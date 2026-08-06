import "dotenv/config";

import { ethers } from "hardhat";
import { Pool } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from .env");
  }

  const [, company, tester] =
    await ethers.getSigners();

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const participants = [
      {
        wallet: company.address,
        type: 1,
        organizationId:
          ethers.id("SOFTWARE_COMPANY_A"),
        displayName: "Local Company",
        email: "company.local@example.test",
        companyName: "Software Company A",
      },
      {
        wallet: tester.address,
        type: 2,
        organizationId:
          ethers.id("INDEPENDENT_TESTER_A"),
        displayName: "Local Tester",
        email: "tester.local@example.test",
        companyName: null,
      },
    ];

    for (const participant of participants) {
      await pool.query(
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
          verified_at
        )
        VALUES (
          $1, $2, $3,
          TRUE, TRUE, FALSE,
          $4, $5, $6, NOW()
        )
        ON CONFLICT DO NOTHING;
        `,
        [
          participant.wallet.toLowerCase(),
          participant.type,
          participant.organizationId,
          participant.displayName,
          participant.email,
          participant.companyName,
        ]
      );
    }

    console.log("Local participants seeded.");
    console.log("Company:", company.address);
    console.log("Tester:", tester.address);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
