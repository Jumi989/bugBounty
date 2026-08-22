import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing from .env"
    );
  }

  const migrationPath =
    path.join(
      process.cwd(),
      "database",
      "migrations",
      "005_tester_reports_rewards.sql"
    );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(
      `Migration file was not found: ${migrationPath}`
    );
  }

  const pool =
    new Pool({
      connectionString: databaseUrl,
    });

  try {
    const sql =
      fs.readFileSync(
        migrationPath,
        "utf8"
      );

    await pool.query(sql);

    console.log(
      "Tester/report/reward migration completed successfully."
    );
  } finally {
    await pool.end();
  }
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  }
);