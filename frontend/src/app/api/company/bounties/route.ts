import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        chain_id,
        escrow_address,
        bounty_id,
        company_address,
        company_organization_id,
        metadata_hash,
        metadata_cid,
        total_escrow_wei,
        available_escrow_wei,
        start_time,
        end_time,
        refund_available_at,
        status,
        creation_tx_hash,
        block_number,
        created_at,
        updated_at
      FROM bounties
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      bounties: result.rows,
    });
  } catch (error) {
    console.error(
      "FETCH BOUNTIES ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch bounties.",
      },
      {
        status: 500,
      }
    );
  }
}