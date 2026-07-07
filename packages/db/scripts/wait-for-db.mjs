import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 30_000);
const startedAt = Date.now();

if (!databaseUrl) {
  console.error("DATABASE_URL is required before waiting for Postgres.");
  process.exit(1);
}

while (Date.now() - startedAt < timeoutMs) {
  const sql = postgres(databaseUrl, {
    connect_timeout: 2,
    idle_timeout: 1,
    max: 1,
    prepare: false,
  });

  try {
    await sql`select 1`;
    await sql.end();
    console.log("Postgres is reachable.");
    process.exit(0);
  } catch {
    await sql.end({ timeout: 1 }).catch(() => undefined);
    await wait(1_000);
  }
}

console.error(`Postgres was not reachable within ${timeoutMs}ms.`);
console.error("Start Postgres with `pnpm db:up`, run `pnpm db:setup:local`, or update DATABASE_URL in .env.");
process.exit(1);

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}
