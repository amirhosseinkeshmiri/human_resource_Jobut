import assert from "node:assert/strict";
import test from "node:test";
import { isPublicJobActive } from "@/jobs/public-policy";
import { isStoredResumeComplete } from "@/resume/policy";
import {
  APPLICATION_BROWSER_FIELDS,
  JOB_APPLICATION_FIELDS,
  applicationUniquenessKey,
  buildApplicationInsert,
  getApplicationEligibility,
  isApplicationOwnedByCandidate,
  shouldKeepApplicationInHistory,
} from "./policy";

const now = new Date("2026-08-10T12:00:00.000Z");
const activeJob = { status: "published" as const, publishedAt: new Date("2026-08-01"), expiresAt: new Date("2026-09-01") };
const completeResume = {
  firstName: "سارا", lastName: "احمدی", city: "تهران", professionalTitle: "برنامه‌نویس",
  professionalSummary: "توسعه‌دهنده نرم‌افزار", skills: ["TypeScript"], linkedinUrl: null, portfolioUrl: null,
  experiences: [], educations: [], languages: [],
};

test("Candidate with a valid Resume can apply to an active Job", () => {
  assert.equal(isStoredResumeComplete(completeResume), true);
  assert.equal(getApplicationEligibility({ authenticated: true, resumeComplete: true, job: activeJob, alreadyApplied: false }, now), "eligible");
});

test("missing or incomplete Resume blocks application", () => {
  assert.equal(getApplicationEligibility({ authenticated: true, resumeComplete: false, job: activeJob, alreadyApplied: false }, now), "resume-required");
  assert.equal(isStoredResumeComplete({ ...completeResume, skills: [] }), false);
});

test("draft, closed, and expired Jobs cannot receive Applications", () => {
  for (const job of [
    { status: "draft" as const, publishedAt: null, expiresAt: null },
    { status: "closed" as const, publishedAt: new Date("2026-08-01"), expiresAt: new Date("2026-09-01") },
    { status: "published" as const, publishedAt: new Date("2026-07-01"), expiresAt: now },
  ]) {
    assert.equal(getApplicationEligibility({ authenticated: true, resumeComplete: true, job, alreadyApplied: false }, now), "job-unavailable");
  }
  assert.equal(isPublicJobActive(activeJob, now), true);
});

test("repeated Apply resolves to the already-applied state", () => {
  assert.equal(getApplicationEligibility({ authenticated: true, resumeComplete: true, job: activeJob, alreadyApplied: true }, now), "already-applied");
});

test("Candidate plus Job is the idempotency and concurrency key", () => {
  assert.equal(applicationUniquenessKey("candidate-a", "job-a"), applicationUniquenessKey("candidate-a", "job-a"));
  assert.notEqual(applicationUniquenessKey("candidate-a", "job-a"), applicationUniquenessKey("candidate-b", "job-a"));
});

test("browser supplies only Job ID while Candidate and Resume are server-derived", () => {
  assert.deepEqual(APPLICATION_BROWSER_FIELDS, ["jobPostId"]);
  assert.deepEqual(buildApplicationInsert("candidate-a", "resume-a", "job-a"), {
    candidateAccountId: "candidate-a", candidateResumeId: "resume-a", jobPostId: "job-a", status: "received",
  });
});

test("anonymous visitors cannot create Applications", () => {
  assert.equal(getApplicationEligibility({ authenticated: false, resumeComplete: true, job: activeJob, alreadyApplied: false }, now), "login-required");
});

test("Application ownership scopes Candidate history", () => {
  assert.equal(isApplicationOwnedByCandidate("candidate-a", "candidate-a"), true);
  assert.equal(isApplicationOwnedByCandidate("candidate-a", "candidate-b"), false);
});

test("historical Application remains when its Job expires", () => {
  assert.equal(shouldKeepApplicationInHistory(), true);
  assert.equal(isPublicJobActive({ ...activeJob, expiresAt: now }, now), false);
});

test("JobApplication adds only the minimal ATS status field", () => {
  assert.deepEqual(JOB_APPLICATION_FIELDS, ["id", "candidateAccountId", "candidateResumeId", "jobPostId", "status", "createdAt"]);
});
