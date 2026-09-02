import { NextResponse } from "next/server";
import { database } from "@/lib/database";


export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {

  const { id } = await context.params;


  console.log("REPORT ID RECEIVED:", id);


  const result = await database.query(
    `
    SELECT

    vr.id,
    vr.title,
    vr.severity,
    vr.description,
    vr.steps_to_reproduce,
    vr.evidence_url,
    vr.status,
    vr.created_at,
    vr.tester_wallet,

    b.id AS bounty_id,

    COALESCE(
      bm.title,
      'Unknown Program'
    ) AS bounty_title,


    COALESCE(
      p.display_name,
      'Anonymous Hunter'
    ) AS researcher_name


    FROM vulnerability_reports vr


    LEFT JOIN bounties b
    ON b.id = vr.bounty_db_id


    LEFT JOIN bounty_metadata bm
    ON bm.bounty_id = b.id


    LEFT JOIN participants p
    ON p.id = vr.tester_id


    WHERE vr.id = $1


    LIMIT 1
    `,
    [id]
  );


  console.log(
    "REPORT RESULT:",
    result.rows
  );


  if (result.rows.length === 0) {

    return NextResponse.json(
      {
        success:false,
        message:"No report found"
      },
      {
        status:404
      }
    );

  }


  return NextResponse.json({

    success:true,

    report:result.rows[0]

  });

}




export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const status = body.status;
    const approvedRewardWei =
      body.approved_reward_wei ?? null;

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          message: "Status is required",
        },
        { status: 400 }
      );
    }

    if (status !== "rejected") {
  return NextResponse.json(
    {
      success: false,
      message:
        "This endpoint can only reject reports.",
    },
    { status: 400 }
  );
}

    const result = await database.query(
      `
      UPDATE vulnerability_reports
      SET
        status = $1,
        approved_reward_wei = COALESCE($2, approved_reward_wei),
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [
        status,
        approvedRewardWei,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No report found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report: result.rows[0],
    });
  } catch (error) {
    console.error(
      "REPORT UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update report",
      },
      { status: 500 }
    );
  }
}