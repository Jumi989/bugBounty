import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing from .env"
    );
  }

  const migrationPath = path.join(
    process.cwd(),
    "database",
    "migrations",
    "003_wallet_login.sql"
  );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(
      `Migration was not found: ${migrationPath}`
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
      "Applying wallet-login migration..."
    );

    await pool.query(sql);

    console.log(
      "Wallet-login migration completed successfully."
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
    "Wallet-login migration failed:",
    message
  );

  process.exitCode = 1;
});