import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import postgres from "postgres";
import { endDatabaseConnection } from "../../src/db";
import {
  buildSmsRateLimitRules,
  enforceSmsRateLimit,
  loadSmsRateLimitPolicy,
  SmsRateLimitExceededError,
  SmsRateLimitUnavailableError,
} from "../../src/auth/sms/rate-limit";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.INTEGRATION_TESTS !== "1" || !parsedDatabaseUrl || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.pathname !== "/jobut_test") {
  throw new Error("Integration tests require an explicitly enabled local jobut_test database");
}

const sql = postgres(parsedDatabaseUrl.toString(), { max: 4, prepare: false });
const AUTH_SECRET = "integration-only-secret-longer-than-thirty-two-characters";
function environment(overrides: Record<string, string> = {}) {
  return {
    AUTH_SECRET,
    SMS_RATE_LIMIT_IDENTIFIER_MAX: "100",
    SMS_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS: "600",
    SMS_RATE_LIMIT_IP_MAX: "100",
    SMS_RATE_LIMIT_IP_WINDOW_SECONDS: "600",
    SMS_RATE_LIMIT_GLOBAL_MAX: "100",
    SMS_RATE_LIMIT_GLOBAL_WINDOW_SECONDS: "600",
    SMS_RATE_LIMIT_ADMIN_IDENTIFIER_MAX: "2",
    SMS_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS: "900",
    SMS_RATE_LIMIT_ADMIN_IP_MAX: "4",
    SMS_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS: "900",
    ...overrides,
  };
}

beforeEach(async () => { await sql`truncate table sms_rate_limits`; });
after(async () => { await endDatabaseConnection(); await sql.end(); });

test("disposable harness can hold independent PostgreSQL connections", async () => {
  const first = postgres(parsedDatabaseUrl.toString(), { max: 1, prepare: false });
  const second = postgres(parsedDatabaseUrl.toString(), { max: 1, prepare: false });
  try {
    const [[left], [right]] = await Promise.all([
      first`select pg_backend_pid()::int as pid`,
      second`select pg_backend_pid()::int as pid`,
    ]);
    assert.notEqual(left.pid, right.pid);
  } finally {
    await Promise.all([first.end(), second.end()]);
  }
});

test("PostgreSQL limiter atomically enforces a shared global quota under concurrency", async () => {
  const env = environment({ SMS_RATE_LIMIT_GLOBAL_MAX: "3" });
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) =>
    enforceSmsRateLimit({
      domain: "candidate",
      identifier: `+98914${String(index).padStart(7, "0")}`,
      clientIp: `198.51.100.${index + 1}`,
      environment: env,
    }),
  ));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(rejected.length, 9);
  assert.equal(rejected.every((result) => result.reason instanceof SmsRateLimitExceededError), true);
  const [globalBucket] = await sql`select request_count from sms_rate_limits where bucket_key = 'sms:provider:global'`;
  assert.equal(globalBucket.request_count, 3);
});

test("identifier quota is shared across candidate and employer domains", async () => {
  const env = environment({ SMS_RATE_LIMIT_IDENTIFIER_MAX: "2" });
  const shared = { identifier: "+989141234567", clientIp: "198.51.100.40", environment: env };
  await enforceSmsRateLimit({ domain: "candidate", ...shared });
  await enforceSmsRateLimit({ domain: "employer", ...shared });
  await assert.rejects(enforceSmsRateLimit({ domain: "candidate", ...shared }), SmsRateLimitExceededError);
});

test("a rejected multi-bucket consume rolls back earlier bucket increments", async () => {
  const env = environment({ SMS_RATE_LIMIT_GLOBAL_MAX: "1" });
  await enforceSmsRateLimit({ domain: "candidate", identifier: "+989141111111", clientIp: "198.51.100.51", environment: env });
  const blockedIdentifier = "+989142222222";
  const blockedIp = "198.51.100.52";
  await assert.rejects(enforceSmsRateLimit({ domain: "employer", identifier: blockedIdentifier, clientIp: blockedIp, environment: env }), SmsRateLimitExceededError);
  const rules = buildSmsRateLimitRules("employer", blockedIdentifier, blockedIp, loadSmsRateLimitPolicy(env), AUTH_SECRET);
  const privateKeys = rules.filter((rule) => rule.key !== "sms:provider:global").map((rule) => rule.key);
  const rows = await sql`select bucket_key from sms_rate_limits where bucket_key in ${sql(privateKeys)}`;
  assert.equal(rows.length, 0);
});

test("invalid limiter configuration fails closed before any bucket is written", async () => {
  await assert.rejects(
    enforceSmsRateLimit({ domain: "admin", identifier: "+989141234567", clientIp: "198.51.100.60", environment: environment({ SMS_RATE_LIMIT_GLOBAL_MAX: "invalid" }) }),
    SmsRateLimitUnavailableError,
  );
  const [count] = await sql`select count(*)::int as value from sms_rate_limits`;
  assert.equal(count.value, 0);
});
