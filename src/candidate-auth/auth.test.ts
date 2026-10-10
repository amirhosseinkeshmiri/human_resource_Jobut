import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { getChallengeAvailability, MAX_VERIFICATION_ATTEMPTS } from "@/auth/challenge-policy";
import { digestSessionToken } from "@/auth/crypto";
import { CANDIDATE_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE } from "@/auth/session-cookies";
import { createCandidateSessionMaterial, createEmployerSessionMaterial } from "@/auth/session-material";
import { normalizeAuthIdentifier, normalizeVerificationCode } from "@/auth/identifier";
import { candidateSessions, employerSessions } from "@/db/schema";

test("normalizes valid Candidate Iranian mobiles and emails", () => {
  const mobile = { type: "mobile", value: "+989121234567" };
  assert.deepEqual(normalizeAuthIdentifier("09121234567"), mobile);
  assert.deepEqual(normalizeAuthIdentifier("+989121234567"), mobile);
  assert.deepEqual(normalizeAuthIdentifier("۰۹۱۲۱۲۳۴۵۶۷"), mobile);
  assert.deepEqual(normalizeAuthIdentifier(" Candidate@Example.COM "), {
    type: "email",
    value: "candidate@example.com",
  });
});

test("rejects invalid Candidate identifiers", () => {
  assert.equal(normalizeAuthIdentifier("not-an-email"), null);
  assert.equal(normalizeAuthIdentifier("08121234567"), null);
});

test("accepts only normalized six-digit verification codes", () => {
  assert.equal(normalizeVerificationCode("۱۲۳۴۵۶"), "123456");
  assert.equal(normalizeVerificationCode("12345"), null);
  assert.equal(normalizeVerificationCode("1234567"), null);
});

test("rejects expired and exhausted Candidate challenges", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(getChallengeAvailability({ consumedAt: null, expiresAt: new Date(0), attempts: 0 }, now), "expired");
  assert.equal(getChallengeAvailability({ consumedAt: null, expiresAt: new Date("2027-01-01"), attempts: MAX_VERIFICATION_ATTEMPTS }, now), "attempts-exhausted");
});

test("a successfully consumed challenge is single-use", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(getChallengeAvailability({ consumedAt: now, expiresAt: new Date("2027-01-01"), attempts: 0 }, now), "consumed");
});

test("Candidate session stores a digest and expires after thirty days", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const session = createCandidateSessionMaterial("candidate-id", now);
  assert.equal(session.record.candidateAccountId, "candidate-id");
  assert.equal(session.record.tokenDigest, digestSessionToken(session.token));
  assert.equal(session.record.tokenDigest.length, 64);
  assert.equal(session.record.expiresAt.toISOString(), "2026-01-31T00:00:00.000Z");
});

test("Candidate and Employer sessions cannot be accepted across auth surfaces", () => {
  const candidate = createCandidateSessionMaterial("candidate-id");
  const employer = createEmployerSessionMaterial("employer-id");
  assert.equal("employerAccountId" in candidate.record, false);
  assert.equal("candidateAccountId" in employer.record, false);
  assert.notEqual(CANDIDATE_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE);
  assert.notEqual(getTableName(candidateSessions), getTableName(employerSessions));
});

test("Candidate logout scope is isolated from Employer session state", () => {
  assert.equal(getTableName(candidateSessions), "candidate_sessions");
  assert.equal(getTableName(employerSessions), "employer_sessions");
  assert.equal(CANDIDATE_SESSION_COOKIE, "jobut_candidate_session");
  assert.equal(EMPLOYER_SESSION_COOKIE, "jobut_employer_session");
});
