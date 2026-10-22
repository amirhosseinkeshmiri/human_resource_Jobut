import assert from "node:assert/strict";
import test from "node:test";
import type { CandidateRecommendationProfile } from "@/recommendations/queries";
import {
  buildCandidateDashboardProfile,
  CANDIDATE_DASHBOARD_APPLICATION_FIELDS,
  countCandidateApplicationStatuses,
  newestCandidateApplications,
  recommendationPreview,
} from "./candidate-policy";

function profile(overrides: Partial<CandidateRecommendationProfile> = {}): CandidateRecommendationProfile {
  return {
    firstName: "سارا",
    lastName: "احمدی",
    city: "تهران",
    professionalTitle: "توسعه‌دهنده",
    professionalSummary: "توسعه‌دهنده نرم‌افزار",
    skills: ["TypeScript"],
    linkedinUrl: null,
    portfolioUrl: null,
    preferredLocations: [],
    preferredWorkplaceTypes: [],
    preferredEmploymentTypes: [],
    preferredSeniorityLevels: [],
    ...overrides,
  };
}

test("Candidate with no Resume has an incomplete, recommendation-free state", () => {
  const summary = buildCandidateDashboardProfile(null);
  assert.equal(summary.resumeExists, false);
  assert.equal(summary.resumeComplete, false);
  assert.equal(summary.recommendationsUsable, false);
});

test("incomplete and complete Resume states reuse canonical completeness", () => {
  assert.equal(buildCandidateDashboardProfile(profile({ skills: [] })).resumeComplete, false);
  const complete = buildCandidateDashboardProfile(profile());
  assert.equal(complete.resumeComplete, true);
  assert.equal(complete.skillCount, 1);
  assert.equal(complete.professionalTitle, "توسعه‌دهنده");
});

test("missing or empty preferences produce the neutral summary", () => {
  const summary = buildCandidateDashboardProfile(profile());
  assert.equal(summary.hasPreferences, false);
  assert.equal(summary.preferredLocationCount, 0);
  assert.equal(summary.preferredWorkplaceCount, 0);
});

test("selected preferences are summarized by factual counts", () => {
  const summary = buildCandidateDashboardProfile(profile({
    preferredLocations: ["تهران", "شیراز"],
    preferredWorkplaceTypes: ["remote"],
    preferredEmploymentTypes: ["full_time", "project"],
    preferredSeniorityLevels: ["senior"],
  }));
  assert.equal(summary.hasPreferences, true);
  assert.deepEqual([
    summary.preferredLocationCount,
    summary.preferredWorkplaceCount,
    summary.preferredEmploymentCount,
    summary.preferredSeniorityCount,
  ], [2, 1, 2, 1]);
});

test("zero Applications and multiple ATS statuses count accurately", () => {
  assert.deepEqual(countCandidateApplicationStatuses([]), {
    total: 0, received: 0, reviewing: 0, interview: 0, rejected: 0, hired: 0,
  });
  assert.deepEqual(countCandidateApplicationStatuses([
    "received", "received", "reviewing", "interview", "rejected", "hired",
  ]), {
    total: 6, received: 2, reviewing: 1, interview: 1, rejected: 1, hired: 1,
  });
});

test("recent Applications are newest first and limited to five", () => {
  const items = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    createdAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
  }));
  assert.deepEqual(newestCandidateApplications(items).map((item) => item.id), ["6", "5", "4", "3", "2"]);
});

test("recommendation preview is limited to three and no Resume fabricates none", () => {
  assert.deepEqual(recommendationPreview([1, 2, 3, 4]), [1, 2, 3]);
  assert.equal(buildCandidateDashboardProfile(null).recommendationsUsable, false);
});

test("dashboard Application projection excludes private fields", () => {
  for (const field of ["employerNote", "statusHistory", "employerEmail", "employerMobile", "score", "candidateAccountId"]) {
    assert.equal((CANDIDATE_DASHBOARD_APPLICATION_FIELDS as readonly string[]).includes(field), false);
  }
});
