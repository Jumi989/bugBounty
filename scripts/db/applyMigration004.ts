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

  const migrationPath = path.join(
    process.cwd(),
    "database",
    "migrations",
    "004_company_registration.sql"
  );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(
      `Migration file was not found: ${migrationPath}`
    );
  }

  const sql = fs.readFileSync(
    migrationPath,
    "utf8"
  );

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    console.log(
      "Applying company-registration migration..."
    );

    await pool.query(sql);

    console.log(
      "Company-registration migration completed successfully."
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    "Company-registration migration failed:",
    message
  );

  process.exitCode = 1;
});