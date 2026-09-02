import {NextResponse} from "next/server";
import {database} from "@/lib/database";



export async function POST(
request:Request,
context:{
params:Promise<{
id:string
}>
}
){


const {id} =
await context.params;


const body =
await request.json();



const rewardEth =
body.reward;



const rewardWei =
BigInt(
Number(rewardEth)
*
1e18
).toString();



await database.query(

`
UPDATE vulnerability_reports

SET

status='accepted',

approved_reward_wei=$1,

updated_at=NOW()

WHERE id=$2

`,

[
rewardWei,
id
]

);



return NextResponse.json({

success:true

});


}