const rawUrl = process.env.DATABASE_URL;
if (process.env.E2E_TESTS !== "1" || !rawUrl) {
  throw new Error("Refusing E2E database access: E2E_TESTS=1 and DATABASE_URL are required");
}

const url = new URL(rawUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(url.hostname)) throw new Error("E2E DATABASE_URL must use a local host");
if (!url.pathname.toLowerCase().includes("test")) throw new Error("E2E database name must contain 'test'");
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error("AUTH_SECRET with at least 32 characters is required for E2E");
}

console.log(JSON.stringify({ event: "e2e_database_verified", host: url.hostname, databaseIsTest: true }));
