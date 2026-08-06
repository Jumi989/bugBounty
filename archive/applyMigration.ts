import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing from the .env file"
    );
  }

  const migrationPath = path.join(
    process.cwd(),
    "database",
    "migrations",
    "001_initial_schema.sql"
  );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(
      `Migration file was not found: ${migrationPath}`
    );
  }

  const migrationSql = fs.readFileSync(
    migrationPath,
    "utf8"
  );

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const client = await pool.connect();

  try {
    console.log("Applying database migration...");

    await client.query(migrationSql);

    console.log("Migration completed successfully.");

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("Created database tables:");

    for (const row of result.rows) {
      console.log(`- ${row.table_name}`);
    }
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

  console.error("Migration failed:", message);
  process.exitCode = 1;
});