import { NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const claimTransactionHash =
      body.claim_transaction_hash;

    if (!claimTransactionHash) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Claim transaction hash is required",
        },
        { status: 400 }
      );
    }

    const result = await database.query(
      `
      UPDATE vulnerability_reports
      SET
        status = 'claimed',
        claimed_at = NOW(),
        claim_transaction_hash = $1,
        updated_at = NOW()
      WHERE id = $2
        AND status = 'accepted'
      RETURNING *
      `,
      [
        claimTransactionHash,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Report is not ready to be claimed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      report: result.rows[0],
    });
  } catch (error) {
    console.error(
      "CLAIM UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update claim",
      },
      { status: 500 }
    );
  }
}