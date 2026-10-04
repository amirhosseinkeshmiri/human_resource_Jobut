import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const globalForDatabase = globalThis as unknown as {
  jobutSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDatabase.jobutSql ??
  postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.jobutSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql as sqlClient };
