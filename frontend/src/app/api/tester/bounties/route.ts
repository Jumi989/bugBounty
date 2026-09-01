import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const runtime = "nodejs";


export async function GET() {

  try {

    const secret =
      process.env.AUTH_SESSION_SECRET;


    if (!secret) {
      throw new Error(
        "AUTH_SESSION_SECRET missing"
      );
    }


    const cookieStore =
      await cookies();


    const token =
      cookieStore.get(
        "bugbounty_session"
      )?.value;


    if (!token) {

      return NextResponse.json(
        {
          success:false,
          message:"Unauthorized"
        },
        {
          status:401
        }
      );

    }


    await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );


    const result =
      await database.query(

        `
        SELECT

          b.id,
          b.bounty_id,
          b.total_escrow_wei,
          b.available_escrow_wei,
          b.start_time,
          b.end_time,

          m.title,
          m.description,
          m.severity,
          m.scope

        FROM bounties b

        INNER JOIN bounty_metadata m

        ON m.bounty_id = b.id

        WHERE b.status = 1

        ORDER BY b.created_at DESC;

        `

      );


    return NextResponse.json({

      success:true,

      bounties:
        result.rows

    });


  } catch(error) {


    console.error(
      "Bounty loading error:",
      error
    );


    return NextResponse.json(
      {
        success:false,
        message:
        "Could not load bounties"
      },
      {
        status:500
      }
    );

  }

}