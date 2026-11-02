import assert from "node:assert/strict";
import test from "node:test";
import { candidateBasicProfileSchema, candidateResumeSchema } from "@/resume/validation";
import { buildCandidateBasicProfileUpdate, canUpdateCandidateProfile, CANDIDATE_BASIC_PROFILE_FIELDS } from "./policy";

const validProfile = () => ({
  firstName: "  امیر  ", lastName: "کشمیرى", city: "تهران", professionalTitle: "توسعه‌دهنده بک‌اند",
  professionalSummary: "توسعه‌دهنده نرم‌افزار با تمرکز بر سامانه‌های قابل اتکا.",
  linkedinUrl: "https://linkedin.com/in/example", portfolioUrl: "https://example.com",
});

test("basic profile validates and normalizes only shared Resume fields", () => {
  const parsed = candidateBasicProfileSchema.parse(validProfile());
  assert.equal(parsed.firstName, "امیر");
  assert.deepEqual(Object.keys(parsed), [...CANDIDATE_BASIC_PROFILE_FIELDS]);
  assert.equal("email" in parsed, false);
  assert.equal("skills" in parsed, false);
});

test("profile validation retains existing Resume validation contracts", () => {
  assert.equal(candidateBasicProfileSchema.safeParse({ ...validProfile(), firstName: "" }).success, false);
  assert.equal(candidateBasicProfileSchema.safeParse({ ...validProfile(), linkedinUrl: "https://example.com/me" }).success, false);
  assert.equal(candidateResumeSchema.safeParse({ ...validProfile(), skills: ["TypeScript"], experiences: [], educations: [], languages: [] }).success, true);
});

test("candidate ownership denies cross-account profile updates", () => {
  assert.equal(canUpdateCandidateProfile("candidate-a", "candidate-a"), true);
  assert.equal(canUpdateCandidateProfile("candidate-a", "candidate-b"), false);
});

test("profile update plan cannot alter identity or nested Resume data", () => {
  const values = candidateBasicProfileSchema.parse(validProfile());
  const update = buildCandidateBasicProfileUpdate(values);
  assert.deepEqual(Object.keys(update), [...CANDIDATE_BASIC_PROFILE_FIELDS]);
  assert.equal("candidateAccountId" in update, false);
  assert.equal("email" in update, false);
  assert.equal("experiences" in update, false);
});
