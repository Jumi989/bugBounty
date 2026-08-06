import { Pool } from "pg";

function requireEnvironmentVariable(
  name: string
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from frontend/.env.local`
    );
  }

  return value;
}

const databaseUrl =
  requireEnvironmentVariable("DATABASE_URL");

/*
 * During Next.js development, files may reload many times.
 *
 * Without this global cache, every reload could create
 * another PostgreSQL connection pool.
 */
const globalForPostgres = globalThis as unknown as {
  postgresPool?: Pool;
};

export const database =
  globalForPostgres.postgresPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgresPool = database;
}