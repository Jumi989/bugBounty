import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";


async function main(){

const pool =
new Pool({
connectionString:
process.env.DATABASE_URL,
});


const file =
path.join(
process.cwd(),
"database",
"migrations",
"006_allow_bug_hunter_without_org.sql"
);


const sql =
fs.readFileSync(
file,
"utf8"
);


await pool.query(sql);


console.log(
"Migration 006 completed successfully."
);


await pool.end();

}


main().catch(
(error)=>{
console.error(error);
process.exitCode=1;
}
);