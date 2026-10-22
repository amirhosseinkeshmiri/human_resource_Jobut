import assert from "node:assert/strict";
import test from "node:test";
import { rankRecommendationCandidates, type RecommendationCandidate, type RecommendationProfile } from "./policy";

const profile: RecommendationProfile = {
  skills: ["TypeScript", "React"],
  city: "تهران",
  preferredLocations: ["تهران"],
  preferredWorkplaceTypes: ["remote"],
  preferredEmploymentTypes: ["full_time"],
  preferredSeniorityLevels: ["senior"],
};

function job(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    requiredSkills: ["TypeScript"],
    location: "شیراز",
    workplaceType: "onsite",
    employmentType: "project",
    seniorityLevel: "junior",
    publishedAt: new Date("2026-10-01T00:00:00.000Z"),
    publiclyEligible: true,
    alreadyApplied: false,
    ...overrides,
  };
}

test("an overlapping skill creates recommendation eligibility case-insensitively", () => {
  const [recommendation] = rankRecommendationCandidates(profile, [job({ requiredSkills: [" typescript "] })]);
  assert.deepEqual(recommendation.reasons.matchedSkills, [" typescript "]);
});

test("zero meaningful matches are excluded", () => {
  assert.deepEqual(rankRecommendationCandidates(profile, [job({ requiredSkills: ["Go"] })]), []);
});

test("two explicit preference matches satisfy the threshold without a skill match", () => {
  const recommendations = rankRecommendationCandidates(profile, [job({
    requiredSkills: ["Go"],
    workplaceType: "remote",
    employmentType: "full_time",
  })]);
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].reasons.workplaceMatched, true);
  assert.equal(recommendations[0].reasons.employmentMatched, true);
  assert.equal(recommendations[0].reasons.locationMatched, false);
  assert.equal(recommendations[0].reasons.seniorityMatched, false);
});

test("empty preferences are neutral and skills still recommend", () => {
  const neutralProfile = {
    ...profile,
    preferredLocations: [],
    preferredWorkplaceTypes: [],
    preferredEmploymentTypes: [],
    preferredSeniorityLevels: [],
  };
  const [recommendation] = rankRecommendationCandidates(neutralProfile, [job()]);
  assert.equal(recommendation.reasons.workplaceMatched, false);
  assert.equal(recommendation.reasons.employmentMatched, false);
  assert.equal(recommendation.reasons.seniorityMatched, false);
});

for (const [name, stronger] of [
  ["location", { location: "تهران" }],
  ["workplace", { workplaceType: "remote" as const }],
  ["employment", { employmentType: "full_time" as const }],
  ["seniority", { seniorityLevel: "senior" as const }],
] as const) {
  test(`${name} preference match increases rank`, () => {
    const recommendations = rankRecommendationCandidates(profile, [
      job({ id: "b", publishedAt: new Date("2026-10-01"), ...stronger }),
      job({ id: "a", publishedAt: new Date("2026-10-01") }),
    ]);
    assert.equal(recommendations[0].job.id, "b");
  });
}

test("more matching skills rank higher", () => {
  const recommendations = rankRecommendationCandidates(profile, [
    job({ id: "one", requiredSkills: ["React"] }),
    job({ id: "two", requiredSkills: ["React", "TypeScript"] }),
  ]);
  assert.equal(recommendations[0].job.id, "two");
});

test("newest publication and then stable ID break equal-score ties", () => {
  const recommendations = rankRecommendationCandidates(profile, [
    job({ id: "b", publishedAt: new Date("2026-10-02") }),
    job({ id: "c", publishedAt: new Date("2026-10-03") }),
    job({ id: "a", publishedAt: new Date("2026-10-03") }),
  ]);
  assert.deepEqual(recommendations.map((item) => item.job.id), ["a", "c", "b"]);
});

test("matched skill list and reasons include only actual matches", () => {
  const [recommendation] = rankRecommendationCandidates(profile, [job({
    requiredSkills: ["React", "PostgreSQL", "TypeScript"],
    location: "تهران",
    workplaceType: "remote",
  })]);
  assert.deepEqual(recommendation.reasons, {
    matchedSkills: ["React", "TypeScript"],
    locationMatched: true,
    workplaceMatched: true,
    employmentMatched: false,
    seniorityMatched: false,
    resumeCityMatched: false,
  });
});

test("non-public and already-applied Jobs are excluded without affecting other Candidates", () => {
  assert.deepEqual(rankRecommendationCandidates(profile, [job({ publiclyEligible: false })]), []);
  assert.deepEqual(rankRecommendationCandidates(profile, [job({ alreadyApplied: true })]), []);
  assert.equal(rankRecommendationCandidates(profile, [job({ alreadyApplied: false })]).length, 1);
});

test("no skills produces no weak recommendations even with preference matches", () => {
  assert.deepEqual(rankRecommendationCandidates({ ...profile, skills: [] }, [job({
    requiredSkills: ["Go"],
    location: "تهران",
    workplaceType: "remote",
    employmentType: "full_time",
  })]), []);
});
