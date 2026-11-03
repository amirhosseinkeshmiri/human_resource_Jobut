import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICATION_STATUSES,
  APPLICATION_TRANSITION_BROWSER_FIELDS,
  DEFAULT_APPLICATION_STATUS,
  canCompanyTransitionApplication,
  canTransitionApplicationStatus,
  getAllowedApplicationTransitions,
  getEnabledApplicationStatuses,
  isCandidateApplicationWithdrawalEnabled,
  isApplicationStatus,
  isTerminalApplicationStatus,
  matchesExpectedApplicationStatus,
  parseApplicationStatusFilter,
  resolveApplicationTransition,
} from "./status-policy";

test("new Applications start received and arbitrary statuses are rejected", () => {
  assert.equal(DEFAULT_APPLICATION_STATUS, "received");
  assert.equal(isApplicationStatus("received"), true);
  assert.equal(isApplicationStatus("shortlisted"), false);
  assert.deepEqual(APPLICATION_STATUSES, ["received", "reviewing", "interview", "rejected", "hired", "withdrawn"]);
});

test("approved forward, rejection, and correction transitions are allowed", () => {
  for (const [current, target] of [
    ["received", "reviewing"],
    ["received", "rejected"],
    ["reviewing", "interview"],
    ["reviewing", "rejected"],
    ["reviewing", "received"],
    ["interview", "hired"],
    ["interview", "rejected"],
    ["interview", "reviewing"],
  ] as const) {
    assert.equal(canTransitionApplicationStatus(current, target), true, `${current} -> ${target}`);
  }
});

test("hired, rejected, and withdrawn are terminal and invalid transitions are blocked", () => {
  assert.equal(isTerminalApplicationStatus("hired"), true);
  assert.equal(isTerminalApplicationStatus("rejected"), true);
  assert.equal(isTerminalApplicationStatus("withdrawn"), true);
  assert.deepEqual(getAllowedApplicationTransitions("hired"), []);
  assert.deepEqual(getAllowedApplicationTransitions("rejected"), []);
  assert.deepEqual(getAllowedApplicationTransitions("withdrawn"), []);
  assert.equal(canTransitionApplicationStatus("rejected", "hired"), false);
  assert.equal(canTransitionApplicationStatus("hired", "reviewing"), false);
  assert.equal(resolveApplicationTransition("received", "interview"), "invalid");
  assert.equal(resolveApplicationTransition("reviewing", "reviewing"), "noop");
});

test("withdrawn status is hidden until the exact server feature flag is enabled", () => {
  assert.equal(isCandidateApplicationWithdrawalEnabled(undefined), false);
  assert.equal(isCandidateApplicationWithdrawalEnabled("TRUE"), false);
  assert.equal(isCandidateApplicationWithdrawalEnabled("true"), true);
  assert.equal(getEnabledApplicationStatuses(false).includes("withdrawn"), false);
  assert.equal(getEnabledApplicationStatuses(true).includes("withdrawn"), true);
});

test("ownership requires authenticated Company, requested Job, and Application Job alignment", () => {
  assert.equal(canCompanyTransitionApplication({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-1" }), true);
  assert.equal(canCompanyTransitionApplication({ authenticatedCompanyId: null, jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-1" }), false);
  assert.equal(canCompanyTransitionApplication({ authenticatedCompanyId: "a", jobCompanyId: "b", requestedJobId: "job-1", applicationJobId: "job-1" }), false);
  assert.equal(canCompanyTransitionApplication({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-2" }), false);
  assert.deepEqual(APPLICATION_TRANSITION_BROWSER_FIELDS, ["jobId", "applicationId", "targetStatus"]);
});

test("conditional updates reject a stale expected status", () => {
  assert.equal(matchesExpectedApplicationStatus("received", "received"), true);
  assert.equal(matchesExpectedApplicationStatus("reviewing", "received"), false);
});

test("status filters normalize invalid input and preserve every approved filter", () => {
  assert.equal(parseApplicationStatusFilter(undefined), "all");
  assert.equal(parseApplicationStatusFilter("all"), "all");
  for (const status of getEnabledApplicationStatuses(false)) assert.equal(parseApplicationStatusFilter(status), status);
  assert.equal(parseApplicationStatusFilter("withdrawn"), "all");
  assert.equal(parseApplicationStatusFilter("unknown"), "all");
  assert.equal(parseApplicationStatusFilter(["reviewing", "received"]), "reviewing");
});
