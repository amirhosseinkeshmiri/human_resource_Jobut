import assert from "node:assert/strict";
import test from "node:test";
import { getChallengeAvailability } from "../challenge-policy";
import {
  digestVerificationCode,
  formatVerificationCode,
  generateVerificationCode,
  verificationCodeMatches,
} from "../crypto";
import { deliverVerificationCode, resolveVerificationDeliveryMode } from "../delivery";
import {
  isWithinVerificationCodeCooldown,
  issueVerificationChallenge,
} from "../issue-challenge";
import {
  loadMeliPayamakConfig,
  sendMeliPayamakOtp,
  SmsProviderError,
  toMeliPayamakPhone,
} from "./melipayamak";

const endpoint = "https://console.melipayamak.com/api/send/simple/jobut-secret";
const sender = "500012345";
const providerEnvironment = {
  MELIPAYAMAK_SIMPLE_ENDPOINT: endpoint,
  MELIPAYAMAK_FROM: sender,
  SMS_TIMEOUT_MS: "5000",
};

function assertCategory(category: string) {
  return (error: unknown) => error instanceof SmsProviderError && error.category === category;
}

test("production provider requires the secret simple endpoint and sender", () => {
  assert.throws(() => loadMeliPayamakConfig({}), assertCategory("configuration"));
  assert.throws(
    () => loadMeliPayamakConfig({ MELIPAYAMAK_SIMPLE_ENDPOINT: endpoint }),
    assertCategory("configuration"),
  );
  const config = loadMeliPayamakConfig(providerEnvironment);
  assert.equal(config.endpoint.toString(), endpoint);
  assert.equal(config.sender, sender);
  assert.equal(config.timeoutMs, 5000);
});

test("production mobile delivery remains isolated from email and development", () => {
  const mobile = { type: "mobile" as const, value: "+989121234567" };
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", "melipayamak"), "melipayamak");
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", undefined), "unavailable");
  assert.equal(resolveVerificationDeliveryMode({ type: "email", value: "user@example.com" }, "production", "melipayamak"), "unavailable");
  assert.equal(resolveVerificationDeliveryMode(mobile, "development", undefined), "development");
});

test("endpoint validation rejects insecure, foreign, credential, query, fragment, and port URLs", () => {
  for (const invalidEndpoint of [
    "http://console.melipayamak.com/api/send/simple/jobut",
    "https://example.com/api/send/simple/jobut",
    "https://user:pass@console.melipayamak.com/api/send/simple/jobut",
    "https://console.melipayamak.com/api/send/simple/jobut?secret=x",
    "https://console.melipayamak.com/api/send/simple/jobut#secret",
    "https://console.melipayamak.com:8443/api/send/simple/jobut",
  ]) {
    assert.throws(
      () => loadMeliPayamakConfig({ ...providerEnvironment, MELIPAYAMAK_SIMPLE_ENDPOINT: invalidEndpoint }),
      assertCategory("configuration"),
    );
  }
});

test("OTP generation is cryptographic, six-digit, and preserves leading zeroes", () => {
  assert.equal(formatVerificationCode(42_731), "042731");
  const originalRandom = Math.random;
  Math.random = () => { throw new Error("Math.random must not be used"); };
  try {
    for (let index = 0; index < 20; index += 1) {
      assert.match(generateVerificationCode(), /^[0-9]{6}$/);
    }
  } finally {
    Math.random = originalRandom;
  }
});

test("simple SMS request uses exact POST JSON and puts OTP only in text", async () => {
  assert.equal(toMeliPayamakPhone("+989121234567"), "09121234567");
  let calls = 0;
  let requestInput: string | URL | Request | undefined;
  let requestInit: RequestInit | undefined;
  const receipt = await sendMeliPayamakOtp(
    "+989121234567",
    "042731",
    (async (input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      requestInput = input;
      requestInit = init;
      return Response.json({ recId: 3741437414, status: "" });
    }) as typeof fetch,
    providerEnvironment,
  );
  assert.deepEqual(receipt, { recId: 3741437414, status: "" });
  assert.equal(calls, 1);
  assert.equal(String(requestInput), endpoint);
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.redirect, "error");
  assert.deepEqual(requestInit?.headers, { "content-type": "application/json" });
  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.deepEqual(body, { from: sender, to: "09121234567", text: "کد ورود به JOBUT: 042731" });
  assert.deepEqual(Object.keys(body).sort(), ["from", "text", "to"]);
  assert.equal(JSON.stringify({ from: body.from, to: body.to }).includes("042731"), false);
});

test("provider response accepts only documented recId/status structure", async () => {
  await sendMeliPayamakOtp(
    "+989121234567",
    "123456",
    (async () => Response.json({ recId: 1, status: "error description if applicable" })) as typeof fetch,
    providerEnvironment,
  );
  for (const response of [
    new Response("not-json", { status: 200 }),
    Response.json({}),
    Response.json({ recId: 1 }),
    Response.json({ status: "" }),
    Response.json({ recId: "1", status: "" }),
    Response.json({ recId: 1, status: 0 }),
    Response.json([1, ""]),
  ]) {
    await assert.rejects(
      sendMeliPayamakOtp("+989121234567", "123456", (async () => response) as typeof fetch, providerEnvironment),
      assertCategory("invalid_response"),
    );
  }
});

test("provider failures, redirects, and bounded responses fail safely without retry", async () => {
  for (const [implementation, category] of [
    [(async () => new Response("failure", { status: 500 })) as typeof fetch, "http"],
    [(async () => new Response(null, { status: 302, headers: { location: "https://example.com" } })) as typeof fetch, "http"],
    [(async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; }) as typeof fetch, "timeout"],
    [(async () => { throw new Error("network detail"); }) as typeof fetch, "network"],
    [(async () => new Response("x".repeat(4097), { status: 200 })) as typeof fetch, "response_too_large"],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      sendMeliPayamakOtp(
        "+989121234567",
        "123456",
        (async (input: string | URL | Request, init?: RequestInit) => {
          calls += 1;
          return implementation(input, init);
        }) as typeof fetch,
        providerEnvironment,
      ),
      assertCategory(category),
    );
    assert.equal(calls, 1);
  }
});

test("provider operation logs neither endpoint nor OTP nor SMS body", async () => {
  const originalLog = console.log;
  const originalError = console.error;
  const entries: unknown[] = [];
  console.log = (...values: unknown[]) => { entries.push(values); };
  console.error = (...values: unknown[]) => { entries.push(values); };
  try {
    await sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => Response.json({ recId: 1, status: "" })) as typeof fetch,
      providerEnvironment,
    );
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual(entries, []);
});

test("two-phase challenge hashes locally generated OTP and never persists raw OTP", async () => {
  const secret = "a-development-test-secret-with-32-characters";
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  let deliveredCode = "";
  let pending: { id: string; pendingDigest: string; pendingExpiresAt: Date } | null = null;
  let active: { id: string; codeDigest: string; expiresAt: Date } | null = null;
  try {
    const result = await issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async (input) => { pending = input; },
        activate: async (input) => { active = input; return true; },
        invalidate: async () => undefined,
      },
      async (_identifier, code) => { deliveredCode = code; return {}; },
    );
    assert.equal(result.challengeId, pending!.id);
    assert.match(deliveredCode, /^[0-9]{6}$/);
    assert.equal(getChallengeAvailability({ consumedAt: null, expiresAt: pending!.pendingExpiresAt, attempts: 0 }), "expired");
    assert.equal(active!.codeDigest, digestVerificationCode(active!.id, deliveredCode, secret));
    assert.equal(verificationCodeMatches(active!.codeDigest, digestVerificationCode(active!.id, deliveredCode, secret)), true);
    assert.equal(JSON.stringify({ pending, active }).includes(deliveredCode), false);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("delivery or activation failure invalidates the pending challenge", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-development-test-secret-with-32-characters";
  let invalidated = false;
  try {
    await assert.rejects(issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      { reserve: async () => undefined, activate: async () => true, invalidate: async () => { invalidated = true; } },
      async () => { throw new Error("delivery failed"); },
    ));
    assert.equal(invalidated, true);
    invalidated = false;
    await assert.rejects(issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      { reserve: async () => undefined, activate: async () => false, invalidate: async () => { invalidated = true; } },
      async () => ({}),
    ));
    assert.equal(invalidated, true);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("development delivery and resend policy remain unchanged", async () => {
  const delivery = await deliverVerificationCode({ type: "email", value: "user@example.com" }, "042731");
  assert.deepEqual(delivery, { developmentCode: "042731" });
  const now = new Date("2026-10-19T10:00:00Z");
  assert.equal(isWithinVerificationCodeCooldown(new Date("2026-10-19T09:59:30Z"), now), true);
  assert.equal(isWithinVerificationCodeCooldown(new Date("2026-10-19T09:58:59Z"), now), false);
});
