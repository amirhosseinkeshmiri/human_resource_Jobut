import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSepRedirectUrl,
  requestSepToken,
  SepProviderError,
  verifySepTransaction,
} from "./sep/adapter";
import { loadSepConfig } from "./sep/config";
import {
  callbackFailureStatus,
  canTransitionAttempt,
  evaluateCallbackCandidate,
  isFormContentType,
  isJsonContentType,
  isRecentActiveAttempt,
  isSameOrigin,
  parseCallbackAmount,
  parseInitiationInput,
  parseSepCallbackForm,
  tomanToRial,
} from "./policy";

const config = loadSepConfig(
  {
    APP_URL: "https://www.jobut.ir",
    SEP_CALLBACK_URL: "https://www.jobut.ir/api/payments/sep/callback",
    SEP_TERMINAL_ID: "terminal-test",
  },
  "production",
);


test("SEP configuration requires values and an exact same-origin callback", () => {
  assert.throws(() => loadSepConfig({}, "production"));
  assert.throws(() =>
    loadSepConfig({
      APP_URL: "https://www.jobut.ir",
      SEP_CALLBACK_URL: "https://evil.example/api/payments/sep/callback",
      SEP_TERMINAL_ID: "terminal-test",
    }, "production"),
  );
  assert.throws(() =>
    loadSepConfig({
      APP_URL: "https://www.jobut.ir",
      SEP_CALLBACK_URL: "https://www.jobut.ir/wrong",
      SEP_TERMINAL_ID: "terminal-test",
    }, "production"),
  );
});

test("Toman is converted to Rial exactly once with safe integer arithmetic", () => {
  assert.equal(tomanToRial(200_000), 2_000_000);
  assert.equal(parseCallbackAmount("2000000"), tomanToRial(200_000));
  assert.throws(() => tomanToRial(0));
  assert.throws(() => tomanToRial(Number.MAX_SAFE_INTEGER));
});

test("token request uses only the exact trusted SEP payload and optional stored mobile", async () => {
  let captured: Record<string, unknown> | null = null;
  const mockFetch = async (_input: string | URL | Request, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ token: "safe-token" });
  };
  const token = await requestSepToken(
    config,
    {
      amountRial: 2_000_000,
      resNum: "11111111-1111-4111-8111-111111111111",
      mobile: "09121234567",
    },
    mockFetch as typeof fetch,
  );
  assert.equal(token, "safe-token");
  assert.deepEqual(captured, {
    action: "token",
    TerminalId: "terminal-test",
    Amount: 2_000_000,
    ResNum: "11111111-1111-4111-8111-111111111111",
    RedirectUrl: "https://www.jobut.ir/api/payments/sep/callback",
    CellNumber: "09121234567",
  });
});

test("email-only employer omits CellNumber rather than inventing one", async () => {
  let captured: Record<string, unknown> = {};
  await requestSepToken(config, { amountRial: 10, resNum: "attempt", mobile: null }, (async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    captured = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ token: "safe-token" });
  }) as typeof fetch);
  assert.equal("CellNumber" in captured, false);
});

test("token failures, invalid JSON, and missing token normalize safely", async () => {
  await assert.rejects(
    requestSepToken(config, { amountRial: 10, resNum: "attempt", mobile: null }, (async () =>
      new Response("down", { status: 502 })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_http",
  );
  await assert.rejects(
    requestSepToken(config, { amountRial: 10, resNum: "attempt", mobile: null }, (async () =>
      new Response("not-json", { status: 200 })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_invalid_response",
  );
  await assert.rejects(
    requestSepToken(config, { amountRial: 10, resNum: "attempt", mobile: null }, (async () =>
      Response.json({ status: 1 })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_invalid_response",
  );
});

test("redirect is locally constructed for the exact SEP HTTPS endpoint", () => {
  const redirect = new URL(buildSepRedirectUrl("a/b?c"));
  assert.equal(redirect.origin, "https://sep.shaparak.ir");
  assert.equal(redirect.pathname, "/OnlinePG/SendToken");
  assert.equal(redirect.searchParams.get("token"), "a/b?c");
  assert.throws(() => buildSepRedirectUrl(""));
});

test("verification accepts only numeric ResultCode zero", async () => {
  const success = await verifySepTransaction(config, "provider-ref", (async () =>
    Response.json({ ResultCode: "0" })) as typeof fetch);
  assert.deepEqual(success, { verified: true });
  await assert.rejects(
    verifySepTransaction(config, "provider-ref", (async () =>
      Response.json({ ResultCode: 2 })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_rejected",
  );
  await assert.rejects(
    verifySepTransaction(config, "provider-ref", (async () =>
      Response.json({ ResultCode: "invalid" })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_invalid_response",
  );
  await assert.rejects(
    verifySepTransaction(config, "provider-ref", (async () =>
      Response.json({ ResultCode: null })) as typeof fetch),
    (error: unknown) => error instanceof SepProviderError && error.category === "provider_invalid_response",
  );
});

test("initiation input rejects amount overrides and malformed purchase IDs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(parseInitiationInput({ purchaseId: id }), { purchaseId: id });
  assert.equal(parseInitiationInput({ purchaseId: id, amount: 1 }), null);
  assert.equal(parseInitiationInput({ purchaseId: "bad" }), null);
});

test("payment request boundaries require exact content types and APP_URL origin", () => {
  assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
  assert.equal(isJsonContentType("text/plain"), false);
  assert.equal(isFormContentType("application/x-www-form-urlencoded"), true);
  assert.equal(isFormContentType("multipart/form-data"), false);
  assert.equal(isSameOrigin("https://www.jobut.ir", "https://www.jobut.ir"), true);
  assert.equal(isSameOrigin("https://evil.example", "https://www.jobut.ir"), false);
});

test("active-attempt window blocks only recent created or redirect-ready attempts", () => {
  const now = new Date("2026-10-11T10:00:00Z");
  assert.equal(isRecentActiveAttempt("created", new Date("2026-10-11T09:50:00Z"), now), true);
  assert.equal(isRecentActiveAttempt("redirect_ready", new Date("2026-10-11T09:40:00Z"), now), false);
  assert.equal(isRecentActiveAttempt("failed", new Date("2026-10-11T09:59:00Z"), now), false);
});

test("callback parsing is bounded, validates amounts, and VERIFIED is terminal", () => {
  const fields = parseSepCallbackForm("State=OK&ResNum=attempt&RefNum=reference&Amount=2000000&Ignored=x");
  assert.deepEqual(fields, {
    state: "OK",
    resNum: "attempt",
    refNum: "reference",
    amountText: "2000000",
  });
  assert.equal(parseCallbackAmount("0"), null);
  assert.equal(parseCallbackAmount("1.5"), null);
  assert.equal(callbackFailureStatus("CanceledByUser"), "canceled");
  assert.equal(callbackFailureStatus("Failed"), "failed");
  assert.equal(canTransitionAttempt("verified", "failed"), false);
  assert.equal(canTransitionAttempt("verified", "verified"), true);
});

test("callback candidate requires OK, RefNum, and the immutable attempt amount", () => {
  const attempt = { status: "redirect_ready" as const, amountRial: 2_000_000 };
  assert.deepEqual(
    evaluateCallbackCandidate(attempt, {
      state: "OK",
      resNum: "attempt",
      refNum: "reference",
      amountText: "2000000",
    }),
    { kind: "verify", refNum: "reference", amount: 2_000_000 },
  );
  assert.deepEqual(
    evaluateCallbackCandidate(attempt, {
      state: "OK",
      resNum: "attempt",
      refNum: null,
      amountText: "2000000",
    }),
    { kind: "invalid" },
  );
  assert.deepEqual(
    evaluateCallbackCandidate(attempt, {
      state: "OK",
      resNum: "attempt",
      refNum: "reference",
      amountText: "20000000",
    }),
    { kind: "invalid" },
  );
  assert.deepEqual(
    evaluateCallbackCandidate({ ...attempt, status: "verified" }, {
      state: null,
      resNum: "attempt",
      refNum: null,
      amountText: null,
    }),
    { kind: "already_verified" },
  );
});

