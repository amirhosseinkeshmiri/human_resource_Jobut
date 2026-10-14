import assert from "node:assert/strict";
import test from "node:test";
import { getChallengeAvailability } from "../challenge-policy";
import { digestVerificationCode, verificationCodeMatches } from "../crypto";
import { resolveVerificationDeliveryMode } from "../delivery";
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

const endpoint = "https://console.melipayamak.com/api/send/jobut-secret";
const providerEnvironment = {
  MELIPAYAMAK_JOBUT_OTP_ENDPOINT: endpoint,
  SMS_TIMEOUT_MS: "5000",
};

function assertCategory(category: string) {
  return (error: unknown) => error instanceof SmsProviderError && error.category === category;
}

test("production provider requires only the dedicated Jobut endpoint", () => {
  assert.throws(() => loadMeliPayamakConfig({}), assertCategory("configuration"));
  assert.throws(
    () => loadMeliPayamakConfig({ SMS_OTP_ENDPOINT: endpoint }),
    assertCategory("configuration"),
  );
  assert.equal(loadMeliPayamakConfig(providerEnvironment).endpoint.toString(), endpoint);
});

test("production mobile delivery fails closed without the explicit MeliPayamak provider", () => {
  const mobile = { type: "mobile" as const, value: "+989121234567" };
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", "melipayamak"), "melipayamak");
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", undefined), "unavailable");
  assert.equal(
    resolveVerificationDeliveryMode({ type: "email", value: "user@example.com" }, "production", "melipayamak"),
    "unavailable",
  );
  assert.equal(resolveVerificationDeliveryMode(mobile, "development", undefined), "development");
});

test("endpoint validation rejects insecure, foreign, credential, query, fragment, and port URLs", () => {
  for (const invalidEndpoint of [
    "http://console.melipayamak.com/api/jobut",
    "https://example.com/api/jobut",
    "https://user:pass@console.melipayamak.com/api/jobut",
    "https://console.melipayamak.com/api/jobut?secret=x",
    "https://console.melipayamak.com/api/jobut#secret",
    "https://console.melipayamak.com:8443/api/jobut",
  ]) {
    assert.throws(
      () => loadMeliPayamakConfig({ MELIPAYAMAK_JOBUT_OTP_ENDPOINT: invalidEndpoint }),
      assertCategory("configuration"),
    );
  }
});

test("canonical Iranian mobile is sent as an exact local phone-only payload once", async () => {
  assert.equal(toMeliPayamakPhone("+989121234567"), "09121234567");
  let calls = 0;
  let requestBody: unknown;
  let redirect: RequestRedirect | undefined;
  const code = await sendMeliPayamakOtp(
    "+989121234567",
    (async (_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      requestBody = JSON.parse(String(init?.body)) as unknown;
      redirect = init?.redirect;
      return Response.json({ code: "123456" });
    }) as typeof fetch,
    providerEnvironment,
  );
  assert.equal(code, "123456");
  assert.equal(calls, 1);
  assert.equal(redirect, "error");
  assert.deepEqual(requestBody, { to: "09121234567" });
  assert.equal("code" in (requestBody as object), false);
  assert.equal("message" in (requestBody as object), false);
  assert.equal("templateId" in (requestBody as object), false);
});

test("provider failures are bounded into safe categories", async () => {
  await assert.rejects(
    sendMeliPayamakOtp("+989121234567", (async () =>
      new Response("failure", { status: 500 })) as typeof fetch, providerEnvironment),
    assertCategory("http"),
  );
  await assert.rejects(
    sendMeliPayamakOtp("+989121234567", (async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch, providerEnvironment),
    assertCategory("timeout"),
  );
  await assert.rejects(
    sendMeliPayamakOtp("+989121234567", (async () => {
      throw new Error("network detail");
    }) as typeof fetch, providerEnvironment),
    assertCategory("network"),
  );
  await assert.rejects(
    sendMeliPayamakOtp("+989121234567", (async () =>
      new Response("x".repeat(4097), { status: 200 })) as typeof fetch, providerEnvironment),
    assertCategory("response_too_large"),
  );
});

test("provider response requires JSON object with exactly usable six-digit code", async () => {
  for (const response of [
    new Response("not-json", { status: 200 }),
    Response.json({}),
    Response.json({ code: "12345" }),
    Response.json({ code: "۱۲۳۴۵۶" }),
    Response.json(["123456"]),
  ]) {
    await assert.rejects(
      sendMeliPayamakOtp("+989121234567", (async () => response) as typeof fetch, providerEnvironment),
      assertCategory("invalid_response"),
    );
  }
});

test("provider operation writes no endpoint, phone, response, or OTP to console", async () => {
  const originalLog = console.log;
  const originalError = console.error;
  const entries: unknown[] = [];
  console.log = (...values: unknown[]) => { entries.push(values); };
  console.error = (...values: unknown[]) => { entries.push(values); };
  try {
    await sendMeliPayamakOtp(
      "+989121234567",
      (async () => Response.json({ code: "123456" })) as typeof fetch,
      providerEnvironment,
    );
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual(entries, []);
});

test("two-phase challenge is unusable pending and activates only an HMAC", async () => {
  const secret = "a-development-test-secret-with-32-characters";
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
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
      async () => ({ code: "123456" }),
    );
    assert.equal(result.challengeId, pending!.id);
    assert.equal(
      getChallengeAvailability({ consumedAt: null, expiresAt: pending!.pendingExpiresAt, attempts: 0 }),
      "expired",
    );
    assert.equal(active!.codeDigest, digestVerificationCode(active!.id, "123456", secret));
    assert.equal(verificationCodeMatches(active!.codeDigest, pending!.pendingDigest), false);
    assert.equal(JSON.stringify({ pending, active }).includes("123456"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("provider or activation failure invalidates the pending challenge", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-development-test-secret-with-32-characters";
  let invalidated = false;
  try {
    await assert.rejects(
      issueVerificationChallenge(
        { type: "mobile", value: "+989121234567" },
        {
          reserve: async () => undefined,
          activate: async () => true,
          invalidate: async () => { invalidated = true; },
        },
        async () => { throw new Error("provider secret response"); },
      ),
    );
    assert.equal(invalidated, true);
    invalidated = false;
    await assert.rejects(
      issueVerificationChallenge(
        { type: "mobile", value: "+989121234567" },
        {
          reserve: async () => undefined,
          activate: async () => false,
          invalidate: async () => { invalidated = true; },
        },
        async () => ({ code: "123456" }),
      ),
    );
    assert.equal(invalidated, true);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("resend cooldown is enforced for one minute", () => {
  const now = new Date("2026-10-11T10:00:00Z");
  assert.equal(
    isWithinVerificationCodeCooldown(new Date("2026-10-11T09:59:30Z"), now),
    true,
  );
  assert.equal(
    isWithinVerificationCodeCooldown(new Date("2026-10-11T09:58:59Z"), now),
    false,
  );
});
