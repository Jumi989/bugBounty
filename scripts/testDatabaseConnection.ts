import "dotenv/config";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from the .env file");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT
        current_user,
        current_database(),
        version();
    `);

    console.log("PostgreSQL connected successfully.");
    console.log("User:", result.rows[0].current_user);
    console.log("Database:", result.rows[0].current_database);
    console.log("Version:", result.rows[0].version);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database connection failed:", error.message);
  process.exitCode = 1;
});