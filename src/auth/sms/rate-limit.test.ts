import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedClientIp, TrustedClientIpError } from "./client-ip";
import {
  buildSmsRateLimitRules,
  enforceSmsRateLimit,
  loadSmsRateLimitPolicy,
  OtpProviderCircuitOpenError,
  recordOtpProviderFailure,
  type RateLimitResult,
  type RateLimitRule,
  SmsRateLimitExceededError,
  SmsRateLimitUnavailableError,
  type SmsRateLimitStore,
} from "./rate-limit";

const AUTH_SECRET = "test-only-auth-secret-that-is-longer-than-32-characters";

class SharedAtomicStore implements SmsRateLimitStore {
  private queue = Promise.resolve();
  private readonly events = new Map<string, number[]>();
  private readonly failures = new Map<string, number[]>();

  constructor(private now = () => Date.now()) {}

  async consume(rules: readonly RateLimitRule[], circuitRule?: RateLimitRule) {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const timestamp = this.now();
      if (circuitRule) {
        const failures = (this.failures.get(circuitRule.key) ?? [])
          .filter((at) => at > timestamp - circuitRule.windowSeconds * 1_000);
        if (failures.length >= circuitRule.limit) throw new OtpProviderCircuitOpenError();
      }
      const pending = rules.map((rule): RateLimitResult => {
        const current = (this.events.get(rule.key) ?? [])
          .filter((at) => at > timestamp - rule.windowSeconds * 1_000);
        if (current.length >= rule.limit) throw new SmsRateLimitExceededError();
        return { key: rule.key, count: current.length + 1, limit: rule.limit };
      });
      for (const rule of rules) {
        const current = (this.events.get(rule.key) ?? [])
          .filter((at) => at > timestamp - rule.windowSeconds * 1_000);
        this.events.set(rule.key, [...current, timestamp]);
      }
      return pending;
    } finally {
      release();
    }
  }

  async recordProviderFailure(bucketKey: string) {
    this.failures.set(bucketKey, [...(this.failures.get(bucketKey) ?? []), this.now()]);
  }
}

function environment(overrides: Record<string, string> = {}) {
  return {
    AUTH_SECRET,
    OTP_RATE_LIMIT_IDENTIFIER_MAX: "10",
    OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS: "600",
    OTP_RATE_LIMIT_ACCOUNT_MAX: "10",
    OTP_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS: "600",
    OTP_IP_RATE_LIMIT_ENABLED: "false",
    OTP_RATE_LIMIT_IP_MAX: "10",
    OTP_RATE_LIMIT_IP_WINDOW_SECONDS: "600",
    OTP_RATE_LIMIT_GLOBAL_MAX: "100",
    OTP_RATE_LIMIT_GLOBAL_WINDOW_SECONDS: "60",
    OTP_RATE_LIMIT_ADMIN_IDENTIFIER_MAX: "2",
    OTP_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS: "900",
    OTP_RATE_LIMIT_ADMIN_IP_MAX: "4",
    OTP_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS: "900",
    OTP_PROVIDER_CIRCUIT_FAILURE_MAX: "5",
    OTP_PROVIDER_CIRCUIT_WINDOW_SECONDS: "300",
    ...overrides,
  };
}

test("mandatory identifier limit works without proxy or client IP configuration", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ OTP_RATE_LIMIT_IDENTIFIER_MAX: "2" });
  await enforceSmsRateLimit({ domain: "candidate", identifier: "user@example.com", environment: env, channel: "email" }, store);
  await enforceSmsRateLimit({ domain: "employer", identifier: "user@example.com", environment: env, channel: "email" }, store);
  await assert.rejects(
    enforceSmsRateLimit({ domain: "candidate", identifier: "user@example.com", environment: env, channel: "email" }, store),
    SmsRateLimitExceededError,
  );
});

test("optional IP limiter blocks multiple identifiers only when enabled", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ OTP_IP_RATE_LIMIT_ENABLED: "true", OTP_RATE_LIMIT_IP_MAX: "2" });
  await enforceSmsRateLimit({ domain: "candidate", identifier: "one@example.com", clientIp: "203.0.113.10", environment: env, channel: "email" }, store);
  await enforceSmsRateLimit({ domain: "employer", identifier: "two@example.com", clientIp: "203.0.113.10", environment: env, channel: "email" }, store);
  await assert.rejects(
    enforceSmsRateLimit({ domain: "candidate", identifier: "three@example.com", clientIp: "203.0.113.10", environment: env, channel: "email" }, store),
    SmsRateLimitExceededError,
  );
});

test("IP protection fails closed when enabled without a trusted address", async () => {
  await assert.rejects(
    enforceSmsRateLimit({
      domain: "candidate",
      identifier: "user@example.com",
      environment: environment({ OTP_IP_RATE_LIMIT_ENABLED: "true" }),
      channel: "email",
    }, new SharedAtomicStore()),
    SmsRateLimitUnavailableError,
  );
});

test("concurrent simulated instances cannot exceed the shared global budget", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ OTP_RATE_LIMIT_GLOBAL_MAX: "3" });
  const attempts = Array.from({ length: 12 }, (_, index) => enforceSmsRateLimit({
    domain: "candidate",
    identifier: `user${index}@example.com`,
    environment: env,
    channel: "email",
  }, store));
  const results = await Promise.allSettled(attempts);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(results.filter((result) => result.status === "rejected").length, 9);
});

test("rolling window expires old events", async () => {
  let now = 1_000_000;
  const store = new SharedAtomicStore(() => now);
  const env = environment({ OTP_RATE_LIMIT_IDENTIFIER_MAX: "1", OTP_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS: "10" });
  const input = { domain: "candidate" as const, identifier: "user@example.com", environment: env, channel: "email" as const };
  await enforceSmsRateLimit(input, store);
  await assert.rejects(enforceSmsRateLimit(input, store), SmsRateLimitExceededError);
  now += 10_001;
  await enforceSmsRateLimit(input, store);
});

test("provider failure circuit opens before another send is authorized", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ OTP_PROVIDER_CIRCUIT_FAILURE_MAX: "2" });
  await recordOtpProviderFailure("email", store);
  await recordOtpProviderFailure("email", store);
  await assert.rejects(
    enforceSmsRateLimit({ domain: "candidate", identifier: "user@example.com", environment: env, channel: "email" }, store),
    OtpProviderCircuitOpenError,
  );
});

test("admin authentication retains a stricter identifier bucket", async () => {
  const store = new SharedAtomicStore();
  const input = { domain: "admin" as const, identifier: "admin@example.com", environment: environment(), channel: "email" as const };
  await enforceSmsRateLimit(input, store);
  await enforceSmsRateLimit(input, store);
  await assert.rejects(enforceSmsRateLimit(input, store), SmsRateLimitExceededError);
});

test("database limiter failure fails closed", async () => {
  const unavailable: SmsRateLimitStore = {
    consume: async () => { throw new Error("database unavailable"); },
    recordProviderFailure: async () => { throw new Error("database unavailable"); },
  };
  await assert.rejects(
    enforceSmsRateLimit({ domain: "candidate", identifier: "user@example.com", environment: environment(), channel: "email" }, unavailable),
    SmsRateLimitUnavailableError,
  );
});

test("bucket keys use HMAC and never contain plaintext identifiers", () => {
  const rules = buildSmsRateLimitRules("candidate", "private@example.com", null, loadSmsRateLimitPolicy(environment()), AUTH_SECRET, "email");
  assert.equal(rules.some((rule) => rule.key.includes("private@example.com")), false);
});

test("spoofed forwarding headers are irrelevant while IP protection is disabled", () => {
  const rules = buildSmsRateLimitRules("candidate", "user@example.com", "1.1.1.1", loadSmsRateLimitPolicy(environment()), AUTH_SECRET, "email");
  assert.equal(rules.some((rule) => rule.key.includes(":ip:")), false);
  assert.throws(() => resolveTrustedClientIp("spoofed, 203.0.113.55", "1"), (error) =>
    error instanceof TrustedClientIpError && error.reason === "invalid_chain",
  );
});

test("SMS and email provider budgets are isolated", () => {
  const policy = loadSmsRateLimitPolicy(environment());
  const sms = buildSmsRateLimitRules("employer", "+989121234567", null, policy, AUTH_SECRET);
  const email = buildSmsRateLimitRules("employer", "user@example.com", null, policy, AUTH_SECRET, "email");
  assert.equal(sms.some((rule) => rule.key === "sms:provider:global"), true);
  assert.equal(email.some((rule) => rule.key === "email:provider:global"), true);
});
