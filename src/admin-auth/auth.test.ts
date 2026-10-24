import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { getChallengeAvailability, MAX_VERIFICATION_ATTEMPTS } from "@/auth/challenge-policy";
import { digestSessionToken } from "@/auth/crypto";
import { ADMIN_SESSION_COOKIE, CANDIDATE_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE } from "@/auth/session-cookies";
import { createAdminSessionMaterial, createCandidateSessionMaterial, createEmployerSessionMaterial } from "@/auth/session-material";
import { adminAccounts, adminSessions, candidateSessions, employerSessions } from "@/db/schema";
import {
  adminDashboardMetricKeys,
  canCreateAdminSession,
  canIssueAdminChallenge,
  deferredAdminMetrics,
  paidPurchaseRevenue,
  sumLedgerAmounts,
} from "./policy";

test("Admin authentication never auto-registers an unknown identifier", () => {
  assert.equal(canIssueAdminChallenge(null), false);
  assert.equal(canIssueAdminChallenge(undefined), false);
  assert.equal(canIssueAdminChallenge("pre-provisioned-admin-id"), true);
  assert.equal(getTableName(adminAccounts), "admin_accounts");
});

test("Admin challenges follow expiration, exhaustion, and single-use policy", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(getChallengeAvailability({ consumedAt: null, expiresAt: new Date(0), attempts: 0 }, now), "expired");
  assert.equal(getChallengeAvailability({ consumedAt: null, expiresAt: new Date("2027-01-01"), attempts: MAX_VERIFICATION_ATTEMPTS }, now), "attempts-exhausted");
  assert.equal(getChallengeAvailability({ consumedAt: now, expiresAt: new Date("2027-01-01"), attempts: 0 }, now), "consumed");
});

test("Admin session uses a digest and thirty-day expiry", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const session = createAdminSessionMaterial("admin-id", now);
  assert.equal(session.record.adminAccountId, "admin-id");
  assert.equal(session.record.tokenDigest, digestSessionToken(session.token));
  assert.equal(session.record.expiresAt.toISOString(), "2026-01-31T00:00:00.000Z");
});

test("Admin session creation requires both a provisioned account and verified challenge", () => {
  assert.equal(canCreateAdminSession("admin-id", true), true);
  assert.equal(canCreateAdminSession("admin-id", false), false);
  assert.equal(canCreateAdminSession(undefined, true), false);
  assert.equal(canCreateAdminSession(null, false), false);
});

test("Admin cookie and session records are isolated from Employer and Candidate", () => {
  const admin = createAdminSessionMaterial("admin-id");
  const employer = createEmployerSessionMaterial("employer-id");
  const candidate = createCandidateSessionMaterial("candidate-id");
  assert.equal("employerAccountId" in admin.record, false);
  assert.equal("candidateAccountId" in admin.record, false);
  assert.equal("adminAccountId" in employer.record, false);
  assert.equal("adminAccountId" in candidate.record, false);
  assert.equal(new Set([ADMIN_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE, CANDIDATE_SESSION_COOKIE]).size, 3);
  assert.equal(new Set([getTableName(adminSessions), getTableName(employerSessions), getTableName(candidateSessions)]).size, 3);
});

test("Admin logout scope targets only Admin session state", () => {
  assert.equal(ADMIN_SESSION_COOKIE, "jobut_admin_session");
  assert.equal(getTableName(adminSessions), "admin_sessions");
  assert.notEqual(ADMIN_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE);
  assert.notEqual(ADMIN_SESSION_COOKIE, CANDIDATE_SESSION_COOKIE);
});

test("pending purchases are excluded from paid revenue", () => {
  assert.equal(paidPurchaseRevenue("pending", 2_000_000), 0);
  assert.equal(paidPurchaseRevenue("paid", 2_000_000), 2_000_000);
});

test("dashboard aggregate policy follows real ledger semantics", () => {
  assert.equal(sumLedgerAmounts([10, -1, -1, 5]), 13);
  assert.equal(adminDashboardMetricKeys.includes("paidPurchaseAmountToman"), true);
  assert.equal(adminDashboardMetricKeys.includes("totalEmployerCredits"), true);
});

test("unavailable Resume and activity metrics are not fabricated as dashboard metrics", () => {
  for (const metric of deferredAdminMetrics) {
    assert.equal((adminDashboardMetricKeys as readonly string[]).includes(metric), false);
  }
});
