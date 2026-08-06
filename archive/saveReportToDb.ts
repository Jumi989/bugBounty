import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query(
    `
    INSERT INTO bug_reports
      (bounty_id, tester_address, bug_type, report_title, report_description, ipfs_cid, bug_hash)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
    `,
    [
      1,
      "0xTesterAddressHere",
      "SQL Injection",
      "SQL Injection in Login Page",
      "The login form is vulnerable to SQL injection.",
      "ipfs://bafyExampleCid",
      "0xBugHashHere",
    ]
  );

  console.log("Saved report:", result.rows[0]);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});