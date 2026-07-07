import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../../..");
const localDir = resolve(rootDir, ".local");
const pgHome = resolve(localDir, "postgres-17.10");
const pgBin = resolve(pgHome, "bin");
const dataDir = resolve(localDir, "pgdata");
const socketDir = resolve(localDir, "pgsocket");
const logFile = resolve(localDir, "postgres.log");
const defaultPort = "5432";

config({ path: resolve(rootDir, ".env"), quiet: true });

const command = process.argv[2] ?? "status";

switch (command) {
  case "setup":
    startPostgres();
    createDatabase();
    break;
  case "start":
    startPostgres();
    break;
  case "stop":
    stopPostgres();
    break;
  case "status":
    statusPostgres();
    break;
  case "createdb":
    createDatabase();
    break;
  default:
    console.error("Usage: pnpm --filter @lightsite/db db:local <setup|start|stop|status|createdb>");
    process.exit(1);
}

function startPostgres() {
  ensurePostgresBinaries();
  ensureCluster();
  mkdirSync(socketDir, { recursive: true });

  if (pgCtl(["status"], { allowFailure: true }).status === 0) {
    console.log("Local Postgres is already running.");
    return;
  }

  pgCtl([
    "start",
    "-l",
    logFile,
    "-o",
    `-p ${getPort()} -k ${socketDir} -c listen_addresses=localhost`,
  ]);
}

function stopPostgres() {
  ensurePostgresBinaries();
  pgCtl(["stop", "-m", "fast"], { allowFailure: true });
}

function statusPostgres() {
  ensurePostgresBinaries();
  const result = pgCtl(["status"], { allowFailure: true });
  process.exit(result.status ?? 1);
}

function createDatabase() {
  ensurePostgresBinaries();
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/lightsite");
  const database = databaseUrl.pathname.slice(1) || "lightsite";
  const user = databaseUrl.username || "postgres";
  const host = databaseUrl.hostname || "localhost";
  const port = databaseUrl.port || getPort();

  run(resolve(pgBin, "psql"), [
    "-h",
    host,
    "-p",
    port,
    "-U",
    user,
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "alter user postgres password 'postgres';",
  ]);

  const exists = run(resolve(pgBin, "psql"), [
    "-h",
    host,
    "-p",
    port,
    "-U",
    user,
    "-d",
    "postgres",
    "-Atc",
    `select 1 from pg_database where datname = '${database.replaceAll("'", "''")}'`,
  ], { capture: true }).stdout.trim() === "1";

  if (exists) {
    console.log(`Database ${database} already exists.`);
    return;
  }

  run(resolve(pgBin, "createdb"), ["-h", host, "-p", port, "-U", user, database]);
  console.log(`Created database ${database}.`);
}

function ensureCluster() {
  if (existsSync(resolve(dataDir, "PG_VERSION"))) {
    return;
  }

  mkdirSync(localDir, { recursive: true });
  run(resolve(pgBin, "initdb"), [
    "-D",
    dataDir,
    "-U",
    "postgres",
    "--auth=trust",
    "--encoding=UTF8",
    "--locale=C",
  ]);
}

function ensurePostgresBinaries() {
  if (existsSync(resolve(pgBin, "pg_ctl"))) {
    return;
  }

  console.error(
    [
      `Local Postgres binaries were not found at ${pgBin}.`,
      "Install Docker Desktop and use pnpm db:setup, or build/install PostgreSQL 17.10 into .local/postgres-17.10.",
    ].join("\n"),
  );
  process.exit(1);
}

function pgCtl(args, options = {}) {
  return run(resolve(pgBin, "pg_ctl"), ["-D", dataDir, ...args], options);
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
  };
}

function getPort() {
  return process.env.PGPORT ?? defaultPort;
}
