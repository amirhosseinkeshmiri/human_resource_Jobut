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

const endpoint = "https://console.melipayamak.com/api/send/shared/jobut-secret";
const providerEnvironment = {
  MELIPAYAMAK_SHARED_ENDPOINT: endpoint,
  MELIPAYAMAK_BODY_ID: "561397",
  SMS_TIMEOUT_MS: "5000",
};
const nativeEndpoint = "https://console.melipayamak.com/api/send/otp/test-placeholder-secret";
const nativeEnvironment = {
  MELIPAYAMAK_SENDING_MODE: "native_otp",
  MELIPAYAMAK_OTP_ENDPOINT: nativeEndpoint,
  SMS_TIMEOUT_MS: "5000",
};

function assertCategory(category: string) {
  return (error: unknown) => error instanceof SmsProviderError && error.category === category;
}

test("production provider requires the secret shared endpoint and positive body ID", () => {
  assert.throws(() => loadMeliPayamakConfig({}), assertCategory("configuration"));
  assert.throws(
    () => loadMeliPayamakConfig({ MELIPAYAMAK_SHARED_ENDPOINT: endpoint }),
    assertCategory("configuration"),
  );
  for (const bodyId of [undefined, "", "0", "-1", "1.5", "abc", "9007199254740992"]) {
    assert.throws(
      () => loadMeliPayamakConfig({ ...providerEnvironment, MELIPAYAMAK_BODY_ID: bodyId }),
      assertCategory("configuration"),
    );
  }
  const config = loadMeliPayamakConfig(providerEnvironment);
  assert.equal(config.mode, "shared_template");
  if (config.mode !== "shared_template") assert.fail("expected shared_template config");
  assert.equal(config.endpoint.toString(), endpoint);
  assert.equal(config.bodyId, 561397);
  assert.equal(config.timeoutMs, 5000);

  const configWithoutObsoleteVariables = loadMeliPayamakConfig({
    MELIPAYAMAK_SHARED_ENDPOINT: endpoint,
    MELIPAYAMAK_BODY_ID: "561397",
  });
  assert.equal(configWithoutObsoleteVariables.mode, "shared_template");
  if (configWithoutObsoleteVariables.mode !== "shared_template") assert.fail("expected shared_template config");
  assert.equal(configWithoutObsoleteVariables.bodyId, 561397);
});

test("production mobile delivery remains isolated from email and development", () => {
  const mobile = { type: "mobile" as const, value: "+989121234567" };
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", "melipayamak"), "melipayamak");
  assert.equal(resolveVerificationDeliveryMode(mobile, "production", undefined), "unavailable");
  assert.equal(resolveVerificationDeliveryMode({ type: "email", value: "user@example.com" }, "production", "melipayamak"), "unavailable");
  assert.equal(resolveVerificationDeliveryMode({ type: "email", value: "user@example.com" }, "production", "melipayamak", "smtp"), "smtp");
  assert.equal(resolveVerificationDeliveryMode(mobile, "development", undefined), "development");
});

test("native OTP configuration requires only the rotated native endpoint", () => {
  const config = loadMeliPayamakConfig(nativeEnvironment);
  assert.deepEqual(config, {
    mode: "native_otp",
    endpoint: new URL(nativeEndpoint),
    timeoutMs: 5000,
  });
  assert.throws(
    () => loadMeliPayamakConfig({ MELIPAYAMAK_SENDING_MODE: "native_otp" }),
    assertCategory("configuration"),
  );
  assert.throws(
    () => loadMeliPayamakConfig({ ...nativeEnvironment, MELIPAYAMAK_OTP_ENDPOINT: endpoint }),
    assertCategory("configuration"),
  );
});

test("endpoint validation rejects insecure, foreign, credential, query, fragment, and port URLs", () => {
  for (const invalidEndpoint of [
    "http://console.melipayamak.com/api/send/shared/jobut",
    "https://example.com/api/send/shared/jobut",
    "https://user:pass@console.melipayamak.com/api/send/shared/jobut",
    "https://console.melipayamak.com/api/send/shared/jobut?secret=x",
    "https://console.melipayamak.com/api/send/shared/jobut#secret",
    "https://console.melipayamak.com:8443/api/send/shared/jobut",
    "https://console.melipayamak.com/api/send/simple/jobut",
    "https://console.melipayamak.com/api/send/shared/",
  ]) {
    assert.throws(
      () => loadMeliPayamakConfig({ ...providerEnvironment, MELIPAYAMAK_SHARED_ENDPOINT: invalidEndpoint }),
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

test("shared-template SMS request uses exact POST JSON and preserves the OTP string", async () => {
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
      return Response.json({ recId: "3741437414", status: "" });
    }) as typeof fetch,
    providerEnvironment,
  );
  assert.deepEqual(receipt, { verificationCode: "042731", recId: "3741437414", status: "" });
  assert.equal(calls, 1);
  assert.equal(String(requestInput), endpoint);
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.redirect, "error");
  assert.deepEqual(requestInit?.headers, { "content-type": "application/json" });
  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.deepEqual(body, { bodyId: 561397, to: "09121234567", args: ["042731"] });
  assert.deepEqual(Object.keys(body).sort(), ["args", "bodyId", "to"]);
  assert.equal(typeof (body.args as unknown[])[0], "string");
  assert.equal("from" in body, false);
  assert.equal("text" in body, false);
  assert.equal(JSON.stringify(body).includes("a-development-test-secret-with-32-characters"), false);
});

test("native OTP sends only the normalized recipient and returns the provider-generated code", async () => {
  let requestInit: RequestInit | undefined;
  const receipt = await sendMeliPayamakOtp(
    "+989121234567",
    "999999",
    (async (_input: string | URL | Request, init?: RequestInit) => {
      requestInit = init;
      return Response.json({ code: "3741437414", status: "" });
    }) as typeof fetch,
    nativeEnvironment,
  );
  assert.deepEqual(receipt, { verificationCode: "3741437414", status: "" });
  assert.deepEqual(JSON.parse(String(requestInit?.body)), { to: "09121234567" });
  assert.equal(String(requestInit?.body).includes("999999"), false);
});

test("native OTP rejects invalid canonical mobile numbers before dispatch", async () => {
  let calls = 0;
  await assert.rejects(
    sendMeliPayamakOtp(
      "09121234567",
      undefined,
      (async () => { calls += 1; return Response.json({ code: "3741437414", status: "" }); }) as typeof fetch,
      nativeEnvironment,
    ),
    assertCategory("invalid_response"),
  );
  assert.equal(calls, 0);
});

test("native OTP rejects provider errors and ambiguous or unsafe codes", async () => {
  for (const [response, category] of [
    [Response.json({ code: "3741437414", status: "provider rejection" }), "rejected"],
    [Response.json({ code: "", status: "" }), "invalid_response"],
    [Response.json({ code: "12345", status: "" }), "invalid_response"],
    [Response.json({ code: "1".repeat(33), status: "" }), "invalid_response"],
    [Response.json({ code: "12345A", status: "" }), "invalid_response"],
    [Response.json({ code: 3741437414, status: "" }), "invalid_response"],
    [Response.json({ status: "" }), "invalid_response"],
    [Response.json({ code: "123456" }), "invalid_response"],
  ] as const) {
    await assert.rejects(
      sendMeliPayamakOtp(
        "+989121234567",
        undefined,
        (async () => response) as typeof fetch,
        nativeEnvironment,
      ),
      assertCategory(category),
    );
  }
  for (const code of ["123456", "1234567", "1".repeat(32)]) {
    const receipt = await sendMeliPayamakOtp(
      "+989121234567",
      undefined,
      (async () => Response.json({ code, status: "" })) as typeof fetch,
      nativeEnvironment,
    );
    assert.equal(receipt.verificationCode, code);
  }
});

test("shared-template response preserves exact numeric receipts and accepts positive receipt precedence", async () => {
  for (const [response, expectedRecId] of [
    [Response.json({ recId: "3741437414", status: "" }), "3741437414"],
    [Response.json({ recId: 3741437414, status: "" }), "3741437414"],
    [Response.json({ recId: "90071992547409931234", status: "provider status detail" }), "90071992547409931234"],
    [new Response('{"recId":90071992547409931234567890,"status":"provider status detail"}'), "90071992547409931234567890"],
    [new Response(`{"recId":${"9".repeat(64)},"status":""}`), "9".repeat(64)],
  ] as const) {
    const receipt = await sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => response) as typeof fetch,
      providerEnvironment,
    );
    assert.equal(receipt.recId, expectedRecId);
  }
  for (const response of [
    new Response("not-json", { status: 200 }),
    Response.json({}),
    Response.json({ recId: 1 }),
    Response.json({ status: "" }),
    Response.json({ recId: "", status: "" }),
    Response.json({ recId: "1.5", status: "" }),
    Response.json({ recId: "accepted", status: "" }),
    new Response(`{"recId":${"9".repeat(65)},"status":""}`),
    new Response('{"recId":1.5,"status":""}'),
    new Response('{"recId":1e400,"status":""}'),
    Response.json({ recId: 1, status: 0 }),
    Response.json([1, ""]),
  ]) {
    await assert.rejects(
      sendMeliPayamakOtp("+989121234567", "123456", (async () => response) as typeof fetch, providerEnvironment),
      assertCategory("invalid_response"),
    );
  }
  await assert.rejects(
    sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => Response.json({ recId: "0", status: "" })) as typeof fetch,
      providerEnvironment,
    ),
    assertCategory("authentication"),
  );
});

test("documented shared-service error recIds are rejected and categorized", async () => {
  for (const [recId, category] of [
    [0, "authentication"],
    [2, "insufficient_credit"],
    [-4, "invalid_pattern"],
    [-5, "invalid_pattern"],
    [-1, "rejected"],
  ] as const) {
    await assert.rejects(
      sendMeliPayamakOtp(
        "+989121234567",
        "123456",
        (async () => Response.json({ recId, status: "provider detail must not be logged" })) as typeof fetch,
        providerEnvironment,
      ),
      assertCategory(category),
    );
  }
  await assert.rejects(
    sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => Response.json({ recId: 2, status: "" })) as typeof fetch,
      providerEnvironment,
    ),
    assertCategory("insufficient_credit"),
  );
  await assert.rejects(
    sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => Response.json({ recId: "-4", status: "provider detail" })) as typeof fetch,
      providerEnvironment,
    ),
    assertCategory("invalid_pattern"),
  );
});

test("shared-template rejection logs only bounded response-shape diagnostics", async () => {
  const originalError = console.error;
  const entries: string[] = [];
  console.error = (value?: unknown) => { entries.push(String(value)); };
  try {
    for (const response of [
      { recId: 2, status: "raw provider rejection text" },
      { recId: -1, status: "another raw rejection" },
      { status: "credential or template detail" },
      { recId: -1, status: "" },
    ]) {
      await assert.rejects(
        sendMeliPayamakOtp(
          "+989121234567",
          "654321",
          (async () => Response.json(response)) as typeof fetch,
          providerEnvironment,
          "00000000-0000-4000-8000-000000000007",
        ),
      );
    }
  } finally {
    console.error = originalError;
  }

  const attempts = entries
    .map((entry) => JSON.parse(entry) as Record<string, unknown>)
    .filter((entry) => entry.event === "sms_provider_attempt");
  assert.deepEqual(
    attempts.map((entry) => entry.providerSignal),
    [
      "status_nonempty_rec_id_positive",
      "status_nonempty_rec_id_nonpositive",
      "status_nonempty_rec_id_missing_or_invalid",
      "status_empty_rec_id_nonpositive",
    ],
  );
  const serialized = JSON.stringify(entries);
  for (const sensitive of [
    "raw provider rejection text",
    "another raw rejection",
    "credential or template detail",
    "654321",
    "+989121234567",
    "09121234567",
    endpoint,
  ]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("failed shared-template responses log only fixed allowlisted shape labels", async () => {
  const originalError = console.error;
  const entries: string[] = [];
  console.error = (value?: unknown) => { entries.push(String(value)); };
  const responses: unknown[] = [
    { status: "secret rejection", code: "secret-code" },
    { recId: -1, status: "secret rejection" },
    { recId: 0, status: "secret rejection" },
    { recId: 1.5, status: "secret rejection" },
    { recId: "not-a-receipt-secret", status: "secret rejection" },
    { recId: null, status: "secret rejection" },
    { recId: { private: "secret" }, status: "secret rejection" },
    { recId: 1, status: 7 },
    { recId: 1, status: null },
    { recId: 1, status: { private: "secret" } },
    { status: "top-level secret status", data: { recId: "nested-secret-receipt", status: "nested secret status" }, code: "secret" },
    { result: { recId: "nested-secret-receipt", status: "nested secret status" } },
    { unexpectedSecretKey: "secret-value" },
    ["secret-array-value"],
  ];
  try {
    for (const response of responses) {
      await assert.rejects(sendMeliPayamakOtp(
        "+989121234567",
        "654321",
        (async () => Response.json(response)) as typeof fetch,
        providerEnvironment,
        "00000000-0000-4000-8000-000000000008",
      ));
    }
    await assert.rejects(sendMeliPayamakOtp(
      "+989121234567",
      "654321",
      (async () => new Response('{"recId":1e400,"status":"nonfinite secret status"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
      providerEnvironment,
      "00000000-0000-4000-8000-000000000008",
    ));
    await assert.rejects(sendMeliPayamakOtp(
      "+989121234567",
      "654321",
      (async () => new Response("secret invalid json", { status: 200 })) as typeof fetch,
      providerEnvironment,
      "00000000-0000-4000-8000-000000000008",
    ));
  } finally {
    console.error = originalError;
  }

  const attempts = entries.map((entry) => JSON.parse(entry) as Record<string, unknown>);
  assert.equal(attempts.length, responses.length + 2);
  assert.deepEqual(
    attempts.map(({ responseEnvelope, recIdPresence, recIdType, recIdShape, statusType, statusShape, codePresent }) =>
      ({ responseEnvelope, recIdPresence, recIdType, recIdShape, statusType, statusShape, codePresent })),
    [
      { responseEnvelope: "top_level_object", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "string", statusShape: "nonempty", codePresent: true },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "negative_decimal", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "zero", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "numeric_fractional", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "string", recIdShape: "malformed", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "null", recIdShape: "not_applicable", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "other", recIdShape: "not_applicable", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "positive_decimal", statusType: "number", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "positive_decimal", statusType: "null", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "positive_decimal", statusType: "other", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "nested_data_object", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "string", statusShape: "nonempty", codePresent: true },
      { responseEnvelope: "nested_result_object", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "absent", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "unrecognized_object", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "absent", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "non_object", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "absent", statusShape: "not_applicable", codePresent: false },
      { responseEnvelope: "top_level_object", recIdPresence: "present", recIdType: "number", recIdShape: "numeric_nonfinite", statusType: "string", statusShape: "nonempty", codePresent: false },
      { responseEnvelope: "invalid_json", recIdPresence: "absent", recIdType: "absent", recIdShape: "not_applicable", statusType: "absent", statusShape: "not_applicable", codePresent: false },
    ],
  );
  const serialized = entries.join("\n");
  for (const sensitive of [
    "secret rejection",
    "secret-code",
    "not-a-receipt-secret",
    "nested-secret-receipt",
    "nested secret status",
    "top-level secret status",
    "unexpectedSecretKey",
    "secret-value",
    "secret-array-value",
    "nonfinite secret status",
    "9007199254740992",
    "1e400",
    "secret invalid json",
    "654321",
    "+989121234567",
    "09121234567",
    endpoint,
  ]) {
    assert.equal(serialized.includes(sensitive), false);
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

test("provider operation logs structured metadata but no endpoint, recipient, OTP, body, or status text", async () => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalError = console.error;
  const entries: unknown[] = [];
  console.log = (...values: unknown[]) => { entries.push(values); };
  console.info = (...values: unknown[]) => { entries.push(values); };
  console.error = (...values: unknown[]) => { entries.push(values); };
  try {
    await sendMeliPayamakOtp(
      "+989121234567",
      "123456",
      (async () => new Response(
        '{"recId":90071992547409931234567890,"status":"private provider status"}',
      )) as typeof fetch,
      providerEnvironment,
      "00000000-0000-4000-8000-000000000004",
    );
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.error = originalError;
  }
  assert.equal(entries.length, 1);
  const serialized = JSON.stringify(entries);
  assert.equal(serialized.includes("sms_provider_attempt"), true);
  assert.equal(serialized.includes("00000000-0000-4000-8000-000000000004"), true);
  assert.equal(serialized.includes("melipayamak"), true);
  assert.equal(serialized.includes("accepted"), true);
  for (const sensitive of [
    endpoint,
    "+989121234567",
    "09121234567",
    "123456",
    "90071992547409931234567890",
    "private provider status",
    "bodyId",
    "args",
  ]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("native provider logs never contain the returned OTP, endpoint secret, or raw error", async () => {
  const originalInfo = console.info;
  const originalError = console.error;
  const entries: string[] = [];
  console.info = (value?: unknown) => { entries.push(String(value)); };
  console.error = (value?: unknown) => { entries.push(String(value)); };
  try {
    await sendMeliPayamakOtp(
      "+989121234567",
      undefined,
      (async () => Response.json({ code: "3741437414", status: "" })) as typeof fetch,
      nativeEnvironment,
      "00000000-0000-4000-8000-000000000005",
    );
    await assert.rejects(sendMeliPayamakOtp(
      "+989121234567",
      undefined,
      (async () => Response.json({ code: "3741437414", status: "credential rejected detail" })) as typeof fetch,
      nativeEnvironment,
      "00000000-0000-4000-8000-000000000006",
    ));
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
  const serialized = entries.join("\n");
  assert.equal(serialized.includes("native_otp"), true);
  for (const sensitive of ["3741437414", "test-placeholder-secret", nativeEndpoint, "09121234567", "credential rejected detail"]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("lossless shared receipt acceptance activates the reserved OTP challenge", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-development-test-secret-with-32-characters";
  let activated = false;
  try {
    const issued = await issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async () => undefined,
        activate: async () => { activated = true; return true; },
        invalidate: async () => undefined,
      },
      async (identifier, code, context) => sendMeliPayamakOtp(
        identifier.value,
        code,
        (async () => new Response(
          '{"recId":90071992547409931234567890,"status":"provider informational status"}',
        )) as typeof fetch,
        providerEnvironment,
        context?.correlationId,
      ),
    );
    assert.equal(activated, true);
    assert.match(issued.challengeId, /^[0-9a-f-]{36}$/i);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
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
      async (_identifier, code) => { deliveredCode = code!; return { verificationCode: code! }; },
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

test("native OTP challenge hashes the provider code rather than the unused local code", async () => {
  const secret = "a-development-test-secret-with-32-characters";
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  const providerCode = "3741437414";
  let active: { id: string; codeDigest: string; expiresAt: Date } | null = null;
  try {
    await issueVerificationChallenge(
      { type: "mobile", value: "+989121234567" },
      {
        reserve: async () => undefined,
        activate: async (input) => { active = input; return true; },
        invalidate: async () => undefined,
      },
      async () => ({ verificationCode: providerCode }),
    );
    assert.equal(active!.codeDigest, digestVerificationCode(active!.id, providerCode, secret));
    assert.equal(JSON.stringify(active).includes(providerCode), false);
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
      async () => ({ verificationCode: "123456" }),
    ));
    assert.equal(invalidated, true);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("development delivery and resend policy remain unchanged", async () => {
  const delivery = await deliverVerificationCode({ type: "email", value: "user@example.com" }, "042731");
  assert.deepEqual(delivery, { developmentCode: "042731", verificationCode: "042731" });
  const now = new Date("2026-10-19T10:00:00Z");
  assert.equal(isWithinVerificationCodeCooldown(new Date("2026-10-19T09:59:30Z"), now), true);
  assert.equal(isWithinVerificationCodeCooldown(new Date("2026-10-19T09:58:59Z"), now), false);
});
