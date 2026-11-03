import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import { APPLICATION_BROWSER_FIELDS } from "@/applications/policy";
import { candidateSavedJobs } from "@/db/schema";
import {
  canMutateSavedJob,
  getSavedJobsOffset,
  getSavedJobsPageCount,
  isCandidateSavedJobsEnabled,
  parseSavedJobsPage,
  SAVED_JOBS_BROWSER_FIELDS,
  SAVED_JOBS_PAGE_SIZE,
  savedJobOwnershipKey,
} from "./policy";

test("Saved Jobs is disabled by default and requires the exact server flag", () => {
  assert.equal(isCandidateSavedJobsEnabled(undefined), false);
  assert.equal(isCandidateSavedJobsEnabled("false"), false);
  assert.equal(isCandidateSavedJobsEnabled("TRUE"), false);
  assert.equal(isCandidateSavedJobsEnabled("true"), true);
});

test("save and remove require Candidate auth, trusted origin, bounded fields, and UUID validation", () => {
  const valid = { featureEnabled: true, authenticatedCandidate: true, originTrusted: true, formBounded: true, jobIdValid: true, desiredStateValid: true };
  assert.equal(canMutateSavedJob(valid), true);
  for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
    assert.equal(canMutateSavedJob({ ...valid, [key]: false }), false, key);
  }
  assert.deepEqual(SAVED_JOBS_BROWSER_FIELDS, ["jobPostId", "saved"]);
});

test("ownership is always scoped by authenticated Candidate and Job", () => {
  assert.notEqual(savedJobOwnershipKey("candidate-a", "job-a"), savedJobOwnershipKey("candidate-b", "job-a"));
  assert.notEqual(savedJobOwnershipKey("candidate-a", "job-a"), savedJobOwnershipKey("candidate-a", "job-b"));
});

test("database schema prevents duplicate and concurrent saves", () => {
  const config = getTableConfig(candidateSavedJobs);
  assert.equal(getTableName(candidateSavedJobs), "candidate_saved_jobs");
  assert.equal(config.primaryKeys.length, 1);
  assert.deepEqual(config.primaryKeys[0]?.columns.map((column) => column.name), ["candidate_account_id", "job_post_id"]);
  assert.equal(config.foreignKeys.length, 2);
});

test("pagination is bounded to twenty newest-oriented rows", () => {
  assert.equal(SAVED_JOBS_PAGE_SIZE, 20);
  assert.equal(parseSavedJobsPage(undefined), 1);
  assert.equal(parseSavedJobsPage("0"), 1);
  assert.equal(parseSavedJobsPage("2"), 2);
  assert.equal(getSavedJobsOffset(2), 20);
  assert.equal(getSavedJobsPageCount(41), 3);
});

test("Saved Jobs inputs remain separate from job application submission", () => {
  assert.deepEqual(APPLICATION_BROWSER_FIELDS, ["jobPostId"]);
  assert.notDeepEqual(SAVED_JOBS_BROWSER_FIELDS, APPLICATION_BROWSER_FIELDS);
});
