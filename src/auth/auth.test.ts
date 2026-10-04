import assert from "node:assert/strict";
import test from "node:test";
import { getChallengeAvailability } from "./challenge-policy";
import {
  digestVerificationCode,
  verificationCodeMatches,
} from "./crypto";
import { normalizeEmployerIdentifier } from "./identifier";
import { createEmployerSessionMaterial } from "./session-material";

test("normalizes employer emails", () => {
  assert.deepEqual(normalizeEmployerIdentifier(" Employer@Example.COM "), {
    type: "email",
    value: "employer@example.com",
  });
});

test("normalizes common Iranian mobile formats", () => {
  const expected = { type: "mobile", value: "+989121234567" };
  assert.deepEqual(normalizeEmployerIdentifier("09121234567"), expected);
  assert.deepEqual(normalizeEmployerIdentifier("+989121234567"), expected);
  assert.deepEqual(normalizeEmployerIdentifier("989121234567"), expected);
  assert.deepEqual(normalizeEmployerIdentifier("۰۹۱۲۱۲۳۴۵۶۷"), expected);
});

test("rejects invalid identifiers", () => {
  assert.equal(normalizeEmployerIdentifier("not-an-email"), null);
  assert.equal(normalizeEmployerIdentifier("08121234567"), null);
});

test("rejects expired and consumed challenges", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(
    getChallengeAvailability({ consumedAt: null, expiresAt: new Date(0), attempts: 0 }, now),
    "expired",
  );
  assert.equal(
    getChallengeAvailability({ consumedAt: now, expiresAt: new Date("2027-01-01"), attempts: 0 }, now),
    "consumed",
  );
});

test("rejects a wrong verification code digest", () => {
  const secret = "a-development-test-secret-with-32-characters";
  const expected = digestVerificationCode("challenge-id", "123456", secret);
  const wrong = digestVerificationCode("challenge-id", "654321", secret);
  assert.equal(verificationCodeMatches(expected, wrong), false);
  assert.equal(verificationCodeMatches(expected, expected), true);
});

test("creates high-entropy session material with aligned expiry", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const session = createEmployerSessionMaterial("account-id", now);
  assert.ok(session.token.length >= 43);
  assert.equal(session.record.tokenDigest.length, 64);
  assert.equal(session.record.employerAccountId, "account-id");
  assert.ok(session.record.expiresAt > now);
});
