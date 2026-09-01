import { NextResponse } from "next/server";
import { database } from "@/lib/database";


export async function GET(){

try{


const result =
await database.query(

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

m.title AS bounty_title


FROM vulnerability_reports vr


JOIN bounties b

ON b.id = vr.bounty_db_id


JOIN bounty_metadata m

ON m.bounty_id = b.id


ORDER BY vr.created_at DESC

`

);



return NextResponse.json({

success:true,

reports:result.rows

});


}
catch(error){

console.error(error);


return NextResponse.json(
{
success:false
},
{
status:500
}
);


}


}