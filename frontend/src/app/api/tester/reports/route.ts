import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bountyId,
      title,
      severity,
      description,
      stepsToReproduce,
      evidenceUrl,
      testerId,
      testerWallet,
    } = body;

    if (
      !bountyId ||
      !title ||
      !severity ||
      !description ||
      !stepsToReproduce ||
      !testerId ||
      !testerWallet
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required report information",
        },
        { status: 400 }
      );
    }

    const canonicalReport = JSON.stringify({
      bountyId,
      title,
      severity,
      description,
      stepsToReproduce,
      evidenceUrl: evidenceUrl || null,
      testerId,
      testerWallet,
    });

    const reportHash =
      "0x" +
      crypto
        .createHash("sha256")
        .update(canonicalReport)
        .digest("hex");

    const result = await database.query(
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
        report_hash,
        status
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted'
      )
      RETURNING *
      `,
      [
        bountyId,
        testerId,
        testerWallet,
        title,
        severity,
        description,
        stepsToReproduce,
        evidenceUrl || null,
        reportHash,
      ]
    );

    return NextResponse.json({
      success: true,
      report: result.rows[0],
    });
  } catch (error) {
    console.error("REPORT CREATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create vulnerability report",
      },
      { status: 500 }
    );
  }
}