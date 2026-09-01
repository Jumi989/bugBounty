import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import crypto from "crypto";

export const runtime = "nodejs";


export async function POST(
  request: Request
) {

  try {

    const body =
      await request.json();


    const {
      bountyId,
      title,
      severity,
      description,
      stepsToReproduce,
      evidence
    } = body;



    if(
      !bountyId ||
      !title ||
      !severity ||
      !description ||
      !stepsToReproduce
    ){

      return NextResponse.json(
        {
          success:false,
          message:
          "Missing required fields"
        },
        {
          status:400
        }
      );

    }



    // Get logged in hunter session

    const cookieStore =
      await cookies();


    const token =
      cookieStore.get(
        "bugbounty_session"
      )?.value;


    if(!token){

      return NextResponse.json(
        {
          success:false,
          message:
          "Not authenticated"
        },
        {
          status:401
        }
      );

    }



    const secret =
      process.env.AUTH_SESSION_SECRET;


    if(!secret){

      throw new Error(
        "Missing session secret"
      );

    }



    const session =
      await jwtVerify(
        token,
        new TextEncoder().encode(secret)
      );



    const testerId =
      session.payload.participantId;



    const wallet =
      session.payload.walletAddress;



    if(
      !testerId ||
      typeof wallet !== "string"
    ){

      return NextResponse.json(
        {
          success:false,
          message:
          "Invalid session"
        },
        {
          status:401
        }
      );

    }



    /*
      Generate report hash

      Later this can be stored on-chain
      when company accepts it.
    */

    const reportHash =
      "0x" +
      crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          bountyId,
          title,
          description,
          wallet,
          timestamp:Date.now()
        })
      )
      .digest("hex");



    const result =
      await database.query(

        `
        INSERT INTO vulnerability_reports

        (
          bounty_db_id,
          tester_id,
          tester_wallet,
          title,
          severity,
          description,
          steps_to_reproduce,
          evidence_url,
          report_hash
        )

        VALUES

        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9
        )

        RETURNING *

        `,

        [
          bountyId,
          testerId,
          wallet,
          title,
          severity,
          description,
          stepsToReproduce,
          evidence ?? null,
          reportHash
        ]

      );



    return NextResponse.json({

      success:true,

      report:
      result.rows[0]

    });



  }
  catch(error){

    console.error(
      "REPORT SUBMISSION ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:false,
        message:
        "Server error"
      },
      {
        status:500
      }
    );

  }

}