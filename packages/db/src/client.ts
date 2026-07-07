import { parseDatabaseEnv } from "@lightsite/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const { DATABASE_POOL_MAX, DATABASE_URL } = parseDatabaseEnv(process.env);

export const queryClient = postgres(DATABASE_URL, {
  max: DATABASE_POOL_MAX,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
