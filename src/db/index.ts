import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as {
  jobutDatabaseConnection?: ReturnType<typeof createConnection>;
};

function createConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return {
    client,
    database: drizzle(client, { schema }),
  };
}

function getConnection() {
  if (!globalForDatabase.jobutDatabaseConnection) {
    globalForDatabase.jobutDatabaseConnection = createConnection();
  }

  return globalForDatabase.jobutDatabaseConnection;
}

type Database = ReturnType<typeof createConnection>["database"];

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getConnection().database;
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

export async function endDatabaseConnection() {
  if (globalForDatabase.jobutDatabaseConnection) {
    await globalForDatabase.jobutDatabaseConnection.client.end();
    globalForDatabase.jobutDatabaseConnection = undefined;
  }
}
