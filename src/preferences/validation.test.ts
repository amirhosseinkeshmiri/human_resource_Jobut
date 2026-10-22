import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { jobApplications, candidateResumes } from "@/db/schema";
import { isStoredResumeComplete } from "@/resume/policy";
import {
  buildCandidatePreferencePersistence,
  CANDIDATE_PREFERENCE_BROWSER_FIELDS,
} from "./policy";
import {
  candidateJobPreferencesFromFormData,
  candidateJobPreferencesSchema,
} from "./validation";

const emptyPreferences = {
  preferredLocations: [],
  preferredWorkplaceTypes: [],
  preferredEmploymentTypes: [],
  preferredSeniorityLevels: [],
};

test("no preferences is valid and represents no restriction", () => {
  assert.deepEqual(candidateJobPreferencesSchema.parse(emptyPreferences), emptyPreferences);
});

test("one through five locations are valid", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredLocations: ["تهران"] }).success, true);
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredLocations: ["تهران", "شیراز", "تبریز", "اصفهان", "رشت"] }).success, true);
});

test("more than five locations is rejected", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredLocations: ["۱", "۲", "۳", "۴", "۵", "۶"] }).success, false);
});

test("locations are trimmed, whitespace-normalized, and deduplicated", () => {
  const parsed = candidateJobPreferencesSchema.parse({
    ...emptyPreferences,
    preferredLocations: ["  تهران  ", "Tehran", " tehran ", "اصفهان   مرکز"],
  });
  assert.deepEqual(parsed.preferredLocations, ["تهران", "Tehran", "اصفهان مرکز"]);
});

test("oversized and blank locations are rejected by the schema", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredLocations: ["ش".repeat(161)] }).success, false);
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredLocations: ["  "] }).success, false);
});

test("approved workplace values are accepted and unexpected values rejected", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredWorkplaceTypes: ["onsite", "remote", "hybrid"] }).success, true);
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredWorkplaceTypes: ["flexible"] }).success, false);
});

test("approved employment values are accepted and unexpected values rejected", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredEmploymentTypes: ["full_time", "part_time", "project", "internship"] }).success, true);
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredEmploymentTypes: ["contract"] }).success, false);
});

test("approved seniority values are accepted and unexpected values rejected", () => {
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredSeniorityLevels: ["intern", "junior", "mid_level", "senior", "lead"] }).success, true);
  assert.equal(candidateJobPreferencesSchema.safeParse({ ...emptyPreferences, preferredSeniorityLevels: ["principal"] }).success, false);
});

test("FormData parsing supports clearing and ignores browser-supplied ownership IDs", () => {
  const formData = new FormData();
  formData.set("candidateAccountId", "candidate-b");
  formData.set("candidateResumeId", "resume-b");
  assert.deepEqual(candidateJobPreferencesFromFormData(formData), emptyPreferences);
  assert.deepEqual(CANDIDATE_PREFERENCE_BROWSER_FIELDS, [
    "preferredLocations",
    "preferredWorkplaceTypes",
    "preferredEmploymentTypes",
    "preferredSeniorityLevels",
  ]);
});

test("persistence ownership comes only from the authenticated Candidate", () => {
  assert.deepEqual(buildCandidatePreferencePersistence("candidate-a", emptyPreferences), {
    candidateAccountId: "candidate-a",
    ...emptyPreferences,
  });
});

test("preferences do not become Resume content or an Application snapshot", () => {
  const resumeColumns = getTableColumns(candidateResumes);
  const applicationColumns = getTableColumns(jobApplications);
  for (const field of CANDIDATE_PREFERENCE_BROWSER_FIELDS) {
    assert.equal(field in resumeColumns, false);
    assert.equal(field in applicationColumns, false);
  }
});

test("Resume completeness remains independent of preferences", () => {
  assert.equal(isStoredResumeComplete({
    firstName: "سارا",
    lastName: "احمدی",
    city: "تهران",
    professionalTitle: "برنامه‌نویس",
    professionalSummary: "توسعه‌دهنده نرم‌افزار",
    skills: ["TypeScript"],
    linkedinUrl: null,
    portfolioUrl: null,
    experiences: [],
    educations: [],
    languages: [],
  }), true);
});
