import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { database } from "@/lib/database";

export const runtime = "nodejs";


const schema = z.object({

  challengeId:
    z.string().uuid(),

  walletAddress:
    z.string().trim(),

  username:
    z.string()
      .trim()
      .min(3)
      .max(80),

  email:
    z.string()
      .trim()
      .email(),

  signature:
    z.string().trim()

});


type ChallengeRow = {

  id:string;

  wallet_address:string;

  registration_payload_hash:string;

  challenge_message:string;

  expires_at:Date;

  used_at:Date|null;

};



export async function POST(
request:Request
):Promise<NextResponse>{


const client =
await database.connect();


try {


const body =
await request.json();


const validation =
schema.safeParse(body);



if(!validation.success){

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



const {

challengeId,
username,
email,
signature

}=validation.data;



let walletAddress:string;


try{

walletAddress =
ethers.getAddress(
validation.data.walletAddress
);

}

catch{

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



const payload =
JSON.stringify([
walletAddress.toLowerCase(),
username,
email.toLowerCase()
]);


const payloadHash =
ethers.keccak256(
ethers.toUtf8Bytes(payload)
);



await client.query("BEGIN");



const challengeResult =
await client.query<ChallengeRow>(
`
SELECT *
FROM tester_registration_challenges
WHERE id=$1
FOR UPDATE;
`,
[
challengeId
]
);



if(challengeResult.rowCount!==1){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Challenge not found."
},
{
status:404
}
);

}



const challenge =
challengeResult.rows[0];



if(
challenge.wallet_address.toLowerCase()
!== walletAddress.toLowerCase()
){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Wallet mismatch."
},
{
status:403
}
);

}



if(challenge.used_at){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Challenge already used."
},
{
status:409
}
);

}



if(
new Date(challenge.expires_at)
.getTime()
<= Date.now()
){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Challenge expired."
},
{
status:410
}
);

}



if(
challenge.registration_payload_hash
.toLowerCase()
!==
payloadHash.toLowerCase()
){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Registration data changed."
},
{
status:409
}
);

}



let recovered:string;


try{

recovered =
ethers.verifyMessage(
challenge.challenge_message,
signature
);

}

catch{

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Invalid signature."
},
{
status:401
}
);

}



if(
recovered.toLowerCase()
!==
walletAddress.toLowerCase()
){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Signer mismatch."
},
{
status:401
}
);

}



const existing =
await client.query(
`
SELECT id
FROM participants
WHERE LOWER(wallet_address)
=
LOWER($1)
LIMIT 1;
`,
[
walletAddress
]
);



if(existing.rowCount){

await client.query("ROLLBACK");

return NextResponse.json(
{
success:false,
message:"Wallet already registered."
},
{
status:409
}
);

}



const participant =
await client.query(
`
INSERT INTO participants
(
wallet_address,
participant_type,
active,
verified,
organization_id,
display_name,
email,
profile_data
)
VALUES
(
$1,
2,
TRUE,
TRUE,
NULL,
$2,
$3,
$4::jsonb
)
RETURNING
id,
wallet_address,
participant_type,
active;
`,
[
walletAddress.toLowerCase(),
username,
email.toLowerCase(),
JSON.stringify({
username
})
]
);



await client.query(
`
UPDATE tester_registration_challenges
SET used_at=NOW()
WHERE id=$1;
`,
[
challengeId
]
);



await client.query("COMMIT");



return NextResponse.json(
{
success:true,
message:"Tester registration completed.",
participant:
participant.rows[0]
},
{
status:201
}
);



}
catch(error){

await client.query("ROLLBACK");


console.error(
"Tester registration failed:",
error
);


return NextResponse.json(
{
success:false,
message:
error instanceof Error
?
error.message
:
"Tester registration failed."
},
{
status:500
}
);


}

finally{

client.release();

}


}