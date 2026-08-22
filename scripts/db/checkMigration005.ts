import "dotenv/config";

import { Pool } from "pg";

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing from .env"
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'tester_registration_challenges',
          'vulnerability_reports'
        )
      ORDER BY table_name;
    `);

    const usernameColumn =
      await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'participants'
          AND column_name = 'username';
      `);

    console.log("New tables:");

    for (const row of tables.rows) {
      console.log(
        "✅",
        row.table_name
      );
    }

    if (
      usernameColumn.rows.length === 1
    ) {
      console.log(
        "✅ participants.username"
      );
    } else {
      console.log(
        "❌ participants.username missing"
      );
    }
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