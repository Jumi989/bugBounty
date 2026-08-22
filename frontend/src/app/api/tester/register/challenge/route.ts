import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  walletAddress: z.string().trim(),
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email(),
});

export async function POST(
  request: Request
): Promise<NextResponse> {

  const body: unknown =
    await request.json();

  const result =
    schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        success:false,
        message:"Invalid tester registration data."
      },
      {
        status:400
      }
    );
  }

  let walletAddress:string;

  try {
    walletAddress =
      ethers.getAddress(
        result.data.walletAddress
      );
  }
  catch {
    return NextResponse.json(
      {
        success:false,
        message:"Invalid wallet address."
      },
      {
        status:400
      }
    );
  }


  const challengeId =
    randomUUID();


  const payload =
    JSON.stringify([
      walletAddress.toLowerCase(),
      result.data.username,
      result.data.email.toLowerCase()
    ]);


  const payloadHash =
    ethers.keccak256(
      ethers.toUtf8Bytes(payload)
    );


  const challengeMessage =
`BugBounty Tester Registration

Wallet:
${walletAddress}

Username:
${result.data.username}

Email:
${result.data.email}

Payload Hash:
${payloadHash}

Challenge ID:
${challengeId}`;


  await database.query(
`
INSERT INTO tester_registration_challenges
(
id,
wallet_address,
registration_payload_hash,
challenge_message,
expires_at
)
VALUES
($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')
`,
[
challengeId,
walletAddress.toLowerCase(),
payloadHash,
challengeMessage
]
);


return NextResponse.json(
{
success:true,
challengeId,
challengeMessage
},
{
status:201
}
);

}