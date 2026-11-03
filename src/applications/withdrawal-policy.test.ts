import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { jobApplications } from "@/db/schema";
import {
  APPLICATION_WITHDRAWAL_BROWSER_FIELDS,
  CANDIDATE_WITHDRAWAL_NOTIFICATION_POLICY,
  WITHDRAWABLE_APPLICATION_STATUSES,
  WITHDRAWAL_PRESERVED_RECORDS,
  WITHDRAWAL_TRANSACTION_STEPS,
  canCandidateWithdrawOwnedApplication,
  canSubmitApplicationWithdrawal,
  canWithdrawApplication,
  resolveCandidateWithdrawal,
} from "./withdrawal-policy";

test("only received, reviewing, and interview Applications can be withdrawn", () => {
  assert.deepEqual(WITHDRAWABLE_APPLICATION_STATUSES, ["received", "reviewing", "interview"]);
  for (const status of WITHDRAWABLE_APPLICATION_STATUSES) assert.equal(canWithdrawApplication(status), true);
  for (const status of ["rejected", "hired", "withdrawn"] as const) assert.equal(canWithdrawApplication(status), false);
});

test("repeat withdrawal is idempotent while final employer states remain blocked", () => {
  assert.equal(resolveCandidateWithdrawal("withdrawn"), "already-withdrawn");
  assert.equal(resolveCandidateWithdrawal("hired"), "not-allowed");
  assert.equal(resolveCandidateWithdrawal("rejected"), "not-allowed");
  assert.equal(resolveCandidateWithdrawal("reviewing"), "withdraw");
});

test("Candidate ownership prevents cross-account withdrawal", () => {
  assert.equal(canCandidateWithdrawOwnedApplication("candidate-a", "candidate-a", "received"), true);
  assert.equal(canCandidateWithdrawOwnedApplication("candidate-a", "candidate-b", "received"), false);
  assert.equal(canCandidateWithdrawOwnedApplication(null, "candidate-a", "received"), false);
});

test("mutation boundary requires auth, feature activation, origin, bounded UUID input, and confirmation", () => {
  const valid = { featureEnabled: true, authenticatedCandidate: true, originTrusted: true, formBounded: true, applicationIdValid: true, explicitlyConfirmed: true };
  assert.equal(canSubmitApplicationWithdrawal(valid), true);
  for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
    assert.equal(canSubmitApplicationWithdrawal({ ...valid, [key]: false }), false, key);
  }
  assert.deepEqual(APPLICATION_WITHDRAWAL_BROWSER_FIELDS, ["applicationId", "confirmed"]);
});

test("withdrawal update and history are atomic and preserve the Application snapshot and uniqueness", () => {
  assert.deepEqual(WITHDRAWAL_TRANSACTION_STEPS, ["lock-owned-application", "validate-current-status", "conditional-status-update", "append-status-history"]);
  assert.deepEqual(WITHDRAWAL_PRESERVED_RECORDS, ["job-application", "resume-snapshot", "status-history", "candidate-job-uniqueness"]);
  const unique = getTableConfig(jobApplications).uniqueConstraints.find((constraint) => constraint.name === "job_applications_candidate_job_unique");
  assert.deepEqual(unique?.columns.map((column) => column.name), ["candidate_account_id", "job_post_id"]);
});

test("Candidate withdrawal does not create a self-notification", () => {
  assert.equal(CANDIDATE_WITHDRAWAL_NOTIFICATION_POLICY, "none");
});
