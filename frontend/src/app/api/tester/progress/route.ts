import { NextResponse } from "next/server";
import { database } from "@/lib/database";


export async function GET(){

try {


const reports =
await database.query(
`
SELECT
COUNT(*) FILTER(
WHERE status='submitted'
) AS submitted,

COUNT(*) FILTER(
WHERE status='accepted'
) AS accepted,

COALESCE(
SUM(approved_reward_wei),
0
) AS rewards

FROM vulnerability_reports
`
);


return NextResponse.json({

success:true,

submitted:
Number(
reports.rows[0].submitted
),

accepted:
Number(
reports.rows[0].accepted
),

rewards:
reports.rows[0].rewards

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