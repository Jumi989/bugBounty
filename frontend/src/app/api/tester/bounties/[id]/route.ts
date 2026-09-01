import { NextResponse } from "next/server";
import { database } from "@/lib/database";


export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>
  }
) {

  try {

    const { id } = await context.params;

    console.log("REQUESTED BOUNTY ID:", id);


    const bountyResult =
      await database.query(
        `
        SELECT *
        FROM bounties
        WHERE id = $1
        `,
        [id]
      );


    console.log(
      "BOUNTY RESULT:",
      bountyResult.rows
    );


    const metadataResult =
      await database.query(
        `
        SELECT *
        FROM bounty_metadata
        WHERE bounty_id = $1
        `,
        [id]
      );


    console.log(
      "METADATA RESULT:",
      metadataResult.rows
    );


    if (
      bountyResult.rows.length === 0
    ) {

      return NextResponse.json({
        success:false,
        message:"No bounty table record"
      });

    }


    if (
      metadataResult.rows.length === 0
    ) {

      return NextResponse.json({
        success:false,
        message:"No metadata record"
      });

    }


    return NextResponse.json({

      success:true,

      bounty:{
        ...bountyResult.rows[0],
        ...metadataResult.rows[0]
      }

    });


  }
  catch(error){

    console.error(
      "DETAIL API ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:false,
        error:String(error)
      },
      {
        status:500
      }
    );

  }

}