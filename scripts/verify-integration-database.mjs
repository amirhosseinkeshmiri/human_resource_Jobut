import postgres from "postgres";

const rawUrl = process.env.DATABASE_URL;
if (process.env.INTEGRATION_TESTS !== "1" || !rawUrl) {
  throw new Error("Refusing database access: INTEGRATION_TESTS=1 and DATABASE_URL are required");
}

const url = new URL(rawUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error("Refusing non-PostgreSQL DATABASE_URL");
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) throw new Error("Refusing non-local PostgreSQL host");
if (url.pathname !== "/jobut_test") throw new Error("Refusing database other than exact jobut_test");

url.searchParams.set("application_name", "jobut_disposable_integration_verification");
const sql = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 5 });
try {
  const [identity] = await sql`
    select
      current_database() as database_name,
      current_user as database_user,
      inet_server_addr()::text as server_address,
      pg_is_in_recovery() as is_replica,
      current_setting('server_version') as server_version
  `;
  if (identity.database_name !== "jobut_test") throw new Error("Connected database identity is not jobut_test");
  const serverAddress = identity.server_address?.split("/")[0] ?? null;
  if (serverAddress !== null && !["127.0.0.1", "::1"].includes(serverAddress)) throw new Error("Connected PostgreSQL server is not loopback-local");
  if (identity.is_replica) throw new Error("Refusing a replica server");
  console.log(JSON.stringify({ verified: true, ...identity, server_address: serverAddress }));
} finally {
  await sql.end();
}
