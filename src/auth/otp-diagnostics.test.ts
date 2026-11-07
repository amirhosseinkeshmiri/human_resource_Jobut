import assert from "node:assert/strict";
import test from "node:test";
import {
  ChallengeCooldownError,
  VerificationChallengeError,
  issueVerificationChallenge,
  verificationChallengeErrorMessage,
} from "./issue-challenge";
import { safeOtpErrorCode } from "./otp-diagnostics";
import { SmsRateLimitUnavailableError } from "./sms/rate-limit";
import { TrustedClientIpError } from "./sms/client-ip";

const TEST_SECRET = "test-only-auth-secret-that-is-longer-than-32-characters";

function smtpError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

test("safe OTP error classification distinguishes SMTP failures without provider details", () => {
  assert.equal(safeOtpErrorCode(smtpError("EAUTH", "secret provider response")), "smtp_authentication");
  assert.equal(safeOtpErrorCode(smtpError("ETIMEDOUT", "host and recipient")), "smtp_timeout");
  assert.equal(safeOtpErrorCode(new Error("email_configuration_smtp_host")), "email_configuration_smtp_host");
  assert.equal(safeOtpErrorCode(new Error("raw secret detail")), "unexpected_error");
});

test("missing trusted proxy configuration logs only a safe chain length", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalError = console.error;
  const entries: string[] = [];
  console.error = (value?: unknown) => { entries.push(String(value)); };
  try {
    await assert.rejects(issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async () => undefined,
        authorize: async () => {
          throw new SmsRateLimitUnavailableError(new TrustedClientIpError("missing_config", 2));
        },
        activate: async () => true,
        invalidate: async () => undefined,
      },
      async () => ({ verificationCode: "123456" }),
      { correlationId: "00000000-0000-4000-8000-000000000003", provider: "melipayamak" },
    ));
  } finally {
    console.error = originalError;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
  const entry = JSON.parse(entries[0]) as Record<string, unknown>;
  assert.equal(entry.stage, "rate_limit");
  assert.equal(entry.errorCode, "trusted_client_ip_missing_config");
  assert.equal(entry.forwardedChainLength, 2);
  assert.equal(entries[0].includes("203.0.113"), false);
});

test("provider failure logs only structured safe diagnostics and invalidates the challenge", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalError = console.error;
  const entries: string[] = [];
  let invalidated = false;
  console.error = (value?: unknown) => { entries.push(String(value)); };
  try {
    await assert.rejects(issueVerificationChallenge(
      { type: "email", value: "private-candidate@example.com" },
      {
        reserve: async () => undefined,
        authorize: async () => undefined,
        activate: async () => true,
        invalidate: async () => { invalidated = true; },
      },
      async () => { throw smtpError("EAUTH", "password=top-secret otp=123456"); },
      { correlationId: "00000000-0000-4000-8000-000000000001", provider: "smtp" },
    ));
  } finally {
    console.error = originalError;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
  assert.equal(invalidated, true);
  assert.equal(entries.length, 1);
  const entry = JSON.parse(entries[0]) as Record<string, unknown>;
  assert.equal(entry.stage, "provider_delivery");
  assert.equal(entry.provider, "smtp");
  assert.equal(entry.errorCode, "smtp_authentication");
  assert.equal(typeof entry.durationMs, "number");
  assert.equal(entries[0].includes("private-candidate"), false);
  assert.equal(entries[0].includes("top-secret"), false);
  assert.equal(entries[0].includes("123456"), false);
});

test("database reserve failure is logged at the pre-delivery stage", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalError = console.error;
  const entries: string[] = [];
  console.error = (value?: unknown) => { entries.push(String(value)); };
  try {
    await assert.rejects(issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async () => { throw Object.assign(new Error("database URL secret"), { code: "08006" }); },
        activate: async () => true,
        invalidate: async () => undefined,
      },
      async () => ({ verificationCode: "123456" }),
      { correlationId: "00000000-0000-4000-8000-000000000002", provider: "melipayamak" },
    ));
  } finally {
    console.error = originalError;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
  const entry = JSON.parse(entries[0]) as Record<string, unknown>;
  assert.equal(entry.stage, "challenge_reserve");
  assert.equal(entry.errorCode, "database_failure");
  assert.equal(entries[0].includes("database URL secret"), false);
});

test("accepted delivery with failed activation remains unusable and reports the persistence stage safely", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalError = console.error;
  const originalInfo = console.info;
  const entries: string[] = [];
  let invalidated = false;
  console.error = (value?: unknown) => { entries.push(String(value)); };
  console.info = (value?: unknown) => { entries.push(String(value)); };
  try {
    await assert.rejects(
      issueVerificationChallenge(
        { type: "mobile", value: "+989121234567" },
        {
          reserve: async () => undefined,
          authorize: async () => undefined,
          activate: async () => false,
          invalidate: async () => { invalidated = true; },
        },
        async () => ({ verificationCode: "123456" }),
        { correlationId: "00000000-0000-4000-8000-000000000004", provider: "melipayamak" },
      ),
      (error: unknown) => {
        assert.equal(error instanceof VerificationChallengeError, true);
        assert.equal((error as VerificationChallengeError).stage, "challenge_activate");
        assert.equal(
          verificationChallengeErrorMessage(error),
          "درخواست ارسال کد پذیرفته شد، اما فعال‌سازی امن کد ورود انجام نشد. لطفاً کد جدید بگیرید.",
        );
        return true;
      },
    );
  } finally {
    console.error = originalError;
    console.info = originalInfo;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
  assert.equal(invalidated, true);
  assert.equal(entries.some((entry) => entry.includes("otp_challenge_activated")), false);
  const failure = entries.find((entry) => entry.includes("otp_delivery_failure"));
  assert.ok(failure);
  assert.equal(JSON.parse(failure).stage, "challenge_activate");
  for (const sensitive of ["+989121234567", "123456", TEST_SECRET]) {
    assert.equal(entries.join("\n").includes(sensitive), false);
  }
});

test("successful activation emits a bounded correlation event and returns a usable challenge", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalInfo = console.info;
  const entries: string[] = [];
  console.info = (value?: unknown) => { entries.push(String(value)); };
  try {
    const issued = await issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async () => undefined,
        authorize: async () => undefined,
        activate: async () => true,
        invalidate: async () => undefined,
      },
      async () => ({ verificationCode: "123456" }),
      { correlationId: "00000000-0000-4000-8000-000000000005", provider: "melipayamak" },
    );
    assert.match(issued.challengeId, /^[0-9a-f-]{36}$/i);
  } finally {
    console.info = originalInfo;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
  assert.equal(entries.length, 1);
  assert.deepEqual(
    Object.keys(JSON.parse(entries[0])).sort(),
    ["correlationId", "durationMs", "event", "provider"].sort(),
  );
  assert.equal(JSON.parse(entries[0]).event, "otp_challenge_activated");
  for (const sensitive of ["+989121234567", "123456", TEST_SECRET]) {
    assert.equal(entries[0].includes(sensitive), false);
  }
});

test("cooldown remains distinguishable for both login actions", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(
      issueVerificationChallenge(
        { type: "mobile", value: "+989121234567" },
        {
          reserve: async () => { throw new ChallengeCooldownError(); },
          activate: async () => true,
          invalidate: async () => undefined,
        },
        async () => ({ verificationCode: "123456" }),
      ),
      ChallengeCooldownError,
    );
    assert.equal(
      verificationChallengeErrorMessage(new ChallengeCooldownError()),
      "برای دریافت کد جدید کمی صبر کنید.",
    );
  } finally {
    console.error = originalError;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});
