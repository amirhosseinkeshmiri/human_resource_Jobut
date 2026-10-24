import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedClientIp, TrustedClientIpError } from "./client-ip";
import {
  enforceSmsRateLimit,
  type RateLimitResult,
  type RateLimitRule,
  SmsRateLimitExceededError,
  SmsRateLimitUnavailableError,
  type SmsRateLimitStore,
} from "./rate-limit";
import { issueVerificationChallenge } from "../issue-challenge";

const AUTH_SECRET = "test-only-auth-secret-that-is-longer-than-32-characters";

class SharedAtomicStore implements SmsRateLimitStore {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly now = () => Date.now()) {}

  async consume(rules: readonly RateLimitRule[]) {
    const currentTime = this.now();
    const pending = rules.map((rule): RateLimitResult & { expiresAt: number } => {
      const existing = this.counters.get(rule.key);
      const count = !existing || existing.expiresAt <= currentTime ? 1 : existing.count + 1;
      return {
        key: rule.key,
        count,
        limit: rule.limit,
        expiresAt:
          !existing || existing.expiresAt <= currentTime
            ? currentTime + rule.windowSeconds * 1_000
            : existing.expiresAt,
      };
    });
    if (pending.some((result) => result.count > result.limit)) return pending;
    for (const result of pending) {
      this.counters.set(result.key, { count: result.count, expiresAt: result.expiresAt });
    }
    return pending;
  }
}

function environment(overrides: Record<string, string> = {}) {
  return {
    AUTH_SECRET,
    SMS_RATE_LIMIT_IDENTIFIER_MAX: "10",
    SMS_RATE_LIMIT_IDENTIFIER_WINDOW_SECONDS: "600",
    SMS_RATE_LIMIT_IP_MAX: "10",
    SMS_RATE_LIMIT_IP_WINDOW_SECONDS: "600",
    SMS_RATE_LIMIT_GLOBAL_MAX: "100",
    SMS_RATE_LIMIT_GLOBAL_WINDOW_SECONDS: "60",
    SMS_RATE_LIMIT_ADMIN_IDENTIFIER_MAX: "2",
    SMS_RATE_LIMIT_ADMIN_IDENTIFIER_WINDOW_SECONDS: "900",
    SMS_RATE_LIMIT_ADMIN_IP_MAX: "4",
    SMS_RATE_LIMIT_ADMIN_IP_WINDOW_SECONDS: "900",
    ...overrides,
  };
}

test("multiple numbers from one IP are blocked before provider delivery", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ SMS_RATE_LIMIT_IP_MAX: "2" });
  let providerCalls = 0;

  for (const identifier of ["+989121111111", "+989122222222"]) {
    await enforceSmsRateLimit(
      { domain: "candidate", identifier, clientIp: "203.0.113.10", environment: env },
      store,
    );
    providerCalls += 1;
  }
  await assert.rejects(
    enforceSmsRateLimit(
      {
        domain: "employer",
        identifier: "+989123333333",
        clientIp: "203.0.113.10",
        environment: env,
      },
      store,
    ),
    SmsRateLimitExceededError,
  );
  assert.equal(providerCalls, 2);
});

test("repeated requests to one identifier are shared across auth domains", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ SMS_RATE_LIMIT_IDENTIFIER_MAX: "2" });
  const input = { identifier: "+989121234567", clientIp: "203.0.113.20", environment: env };

  await enforceSmsRateLimit({ domain: "candidate", ...input }, store);
  await enforceSmsRateLimit({ domain: "employer", ...input }, store);
  await assert.rejects(
    enforceSmsRateLimit({ domain: "candidate", ...input }, store),
    SmsRateLimitExceededError,
  );
});

test("concurrent requests from separate limiter instances share one atomic quota", async () => {
  const sharedStore = new SharedAtomicStore();
  const env = environment({ SMS_RATE_LIMIT_GLOBAL_MAX: "3" });
  const attempts = Array.from({ length: 12 }, (_, index) =>
    enforceSmsRateLimit(
      {
        domain: "candidate",
        identifier: `+98912${String(index).padStart(7, "0")}`,
        clientIp: `203.0.113.${index + 1}`,
        environment: env,
      },
      sharedStore,
    ),
  );

  const results = await Promise.allSettled(attempts);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(results.filter((result) => result.status === "rejected").length, 9);
});

test("global quota exhaustion blocks delivery regardless of identifier and IP", async () => {
  const store = new SharedAtomicStore();
  const env = environment({ SMS_RATE_LIMIT_GLOBAL_MAX: "1" });
  await enforceSmsRateLimit(
    {
      domain: "employer",
      identifier: "+989121111111",
      clientIp: "203.0.113.1",
      environment: env,
    },
    store,
  );
  await assert.rejects(
    enforceSmsRateLimit(
      {
        domain: "candidate",
        identifier: "+989129999999",
        clientIp: "198.51.100.1",
        environment: env,
      },
      store,
    ),
    SmsRateLimitExceededError,
  );
});

test("admin authentication has stricter identifier limits", async () => {
  const store = new SharedAtomicStore();
  const env = environment();
  const input = {
    domain: "admin" as const,
    identifier: "+989121234567",
    clientIp: "203.0.113.30",
    environment: env,
  };
  await enforceSmsRateLimit(input, store);
  await enforceSmsRateLimit(input, store);
  await assert.rejects(enforceSmsRateLimit(input, store), SmsRateLimitExceededError);
});

test("provider failures consume quota and the blocked request never reaches provider", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = AUTH_SECRET;
  const store = new SharedAtomicStore();
  const env = environment({ SMS_RATE_LIMIT_IDENTIFIER_MAX: "2" });
  let providerCalls = 0;
  const callbacks = {
    authorize: () =>
      enforceSmsRateLimit(
        {
          domain: "candidate" as const,
          identifier: "+989121234567",
          clientIp: "203.0.113.40",
          environment: env,
        },
        store,
      ),
    reserve: async () => undefined,
    activate: async () => true,
    invalidate: async () => undefined,
  };
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await assert.rejects(
        issueVerificationChallenge(
          { type: "mobile", value: "+989121234567" },
          callbacks,
          async () => {
            providerCalls += 1;
            throw new Error("provider unavailable");
          },
        ),
        /verification_delivery_failed/,
      );
    }
    await assert.rejects(
      issueVerificationChallenge(
        { type: "mobile", value: "+989121234567" },
        callbacks,
        async () => {
          providerCalls += 1;
          return {};
        },
      ),
      /verification_delivery_failed/,
    );
    assert.equal(providerCalls, 2);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("an unavailable shared limiter fails closed", async () => {
  const unavailableStore: SmsRateLimitStore = {
    consume: async () => {
      throw new Error("database unavailable");
    },
  };
  await assert.rejects(
    enforceSmsRateLimit(
      {
        domain: "candidate",
        identifier: "+989121234567",
        clientIp: "203.0.113.50",
        environment: environment(),
      },
      unavailableStore,
    ),
    SmsRateLimitUnavailableError,
  );
});

test("spoofed left-side forwarding values cannot replace the trusted client boundary", () => {
  assert.equal(
    resolveTrustedClientIp("1.1.1.1, 8.8.8.8, 203.0.113.55", "1"),
    "203.0.113.55",
  );
  assert.equal(
    resolveTrustedClientIp("1.1.1.1, 198.51.100.7, 192.0.2.10", "2"),
    "198.51.100.7",
  );
  assert.throws(() => resolveTrustedClientIp("spoofed, 203.0.113.55", "1"), TrustedClientIpError);
  assert.throws(() => resolveTrustedClientIp("203.0.113.55", undefined), TrustedClientIpError);
});
