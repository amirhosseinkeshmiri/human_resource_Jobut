import assert from "node:assert/strict";
import test from "node:test";
import { SmsRateLimitExceededError } from "@/auth/sms/rate-limit";
import {
  ADMIN_VERIFICATION_FAILURE_MESSAGE,
  issueAdminChallengeIndistinguishably,
} from "./request-outcome";

const TEST_SECRET = "test-only-admin-auth-secret-longer-than-thirty-two-characters";
const identifier = { type: "mobile" as const, value: "+989121234567" };

function assertChallengeShaped(result: Awaited<ReturnType<typeof issueAdminChallengeIndistinguishably>>) {
  assert.equal(result.status, "challenge");
  assert.equal(result.identifier, identifier.value);
  assert.match(result.challengeId, /^[0-9a-f-]{36}$/i);
  assert.match(result.developmentCode ?? "", /^[0-9]{6}$/);
  assert.deepEqual(Object.keys(result).sort(), [
    "challengeId",
    "developmentCode",
    "identifier",
    "status",
  ]);
}

test("known and unknown Admin identifiers receive equivalent public challenge outcomes", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  let knownProviderCalls = 0;
  let unknownProviderCalls = 0;
  let unknownLimiterCalls = 0;
  try {
    const known = await issueAdminChallengeIndistinguishably(identifier, true, {
      developmentDelivery: true,
      authorizeUnknownIdentifier: async () => undefined,
      issueKnownChallenge: async () => {
        knownProviderCalls += 1;
        return {
          challengeId: "11111111-1111-4111-8111-111111111111",
          developmentCode: "123456",
        };
      },
    });
    const unknown = await issueAdminChallengeIndistinguishably(identifier, false, {
      developmentDelivery: true,
      authorizeUnknownIdentifier: async () => {
        unknownLimiterCalls += 1;
      },
      issueKnownChallenge: async () => {
        unknownProviderCalls += 1;
        throw new Error("must not issue");
      },
    });

    assertChallengeShaped(known);
    assertChallengeShaped(unknown);
    assert.equal(knownProviderCalls, 1);
    assert.equal(unknownProviderCalls, 0);
    assert.equal(unknownLimiterCalls, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("provider failures remain an opaque challenge outcome", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  let providerCalls = 0;
  try {
    const result = await issueAdminChallengeIndistinguishably(identifier, true, {
      developmentDelivery: true,
      authorizeUnknownIdentifier: async () => undefined,
      issueKnownChallenge: async () => {
        providerCalls += 1;
        throw new Error("provider failure detail");
      },
    });
    assertChallengeShaped(result);
    assert.equal(providerCalls, 1);
    assert.equal(JSON.stringify(result).includes("provider"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("unknown Admin identifiers retain strict rate limiting without provider invocation", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = TEST_SECRET;
  let limiterCalls = 0;
  let providerCalls = 0;
  try {
    const result = await issueAdminChallengeIndistinguishably(identifier, false, {
      developmentDelivery: true,
      authorizeUnknownIdentifier: async () => {
        limiterCalls += 1;
        throw new SmsRateLimitExceededError();
      },
      issueKnownChallenge: async () => {
        providerCalls += 1;
        return { challengeId: "22222222-2222-4222-8222-222222222222" };
      },
    });
    assertChallengeShaped(result);
    assert.equal(limiterCalls, 1);
    assert.equal(providerCalls, 0);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("all non-successful Admin verification branches use one public message", () => {
  assert.equal(
    ADMIN_VERIFICATION_FAILURE_MESSAGE,
    "کد ورود معتبر نیست یا زمان استفاده از آن به پایان رسیده است.",
  );
  assert.equal(ADMIN_VERIFICATION_FAILURE_MESSAGE.includes("حساب"), false);
  assert.equal(ADMIN_VERIFICATION_FAILURE_MESSAGE.includes("پیامک"), false);
});
