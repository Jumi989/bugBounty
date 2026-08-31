import "dotenv/config";

import { Pool } from "pg";


async function main(){

const pool =
new Pool({
connectionString:
process.env.DATABASE_URL,
});


const result =
await pool.query(
`
SELECT
id,
wallet_address,
participant_type,
active,
verified,
display_name,
email
FROM participants
WHERE participant_type = 2
ORDER BY id DESC
LIMIT 5;
`
);


console.table(
result.rows
);


await pool.end();

}


main().catch(
(error)=>{
console.error(error);
process.exitCode=1;
}
);