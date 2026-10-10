import assert from "node:assert/strict";
import test from "node:test";
import { buildResumePersistencePlan, canCandidateUpdateResume } from "./policy";
import { candidateResumeSchema, resumeEducationSchema, resumeExperienceSchema } from "./validation";

function validResume(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "  سارا  ",
    lastName: "احمدی",
    city: "تهران",
    professionalTitle: "توسعه‌دهنده بک‌اند",
    professionalSummary: "توسعه‌دهنده نرم‌افزار با تمرکز بر سامانه‌های پایدار.",
    skills: ["TypeScript", "PostgreSQL"],
    linkedinUrl: "https://linkedin.com/in/sara",
    portfolioUrl: "https://sara.example.com",
    experiences: [],
    educations: [],
    languages: [],
    ...overrides,
  };
}

test("accepts and normalizes a valid Resume with no Experience or Education", () => {
  const parsed = candidateResumeSchema.parse(validResume());
  assert.equal(parsed.firstName, "سارا");
  assert.deepEqual(parsed.experiences, []);
  assert.deepEqual(parsed.educations, []);
});

for (const [field, message] of [
  ["firstName", "missing first name"],
  ["lastName", "missing last name"],
  ["city", "missing city"],
  ["professionalTitle", "missing professional title"],
  ["professionalSummary", "empty professional summary"],
] as const) {
  test(`rejects ${message}`, () => {
    assert.equal(candidateResumeSchema.safeParse(validResume({ [field]: "  " })).success, false);
  });
}

test("requires one to ten normalized unique skills", () => {
  assert.equal(candidateResumeSchema.safeParse(validResume({ skills: [] })).success, false);
  assert.equal(candidateResumeSchema.safeParse(validResume({ skills: Array.from({ length: 11 }, (_, index) => `skill-${index}`) })).success, false);
  assert.equal(candidateResumeSchema.safeParse(validResume({ skills: ["TypeScript", " typescript "] })).success, false);
  assert.deepEqual(candidateResumeSchema.parse(validResume({ skills: ["  Node.js   API  "] })).skills, ["Node.js API"]);
});

test("validates approved professional URLs and normalizes empty values", () => {
  assert.equal(candidateResumeSchema.safeParse(validResume({ linkedinUrl: "https://example.com/profile" })).success, false);
  assert.equal(candidateResumeSchema.safeParse(validResume({ portfolioUrl: "not-a-url" })).success, false);
  const parsed = candidateResumeSchema.parse(validResume({ linkedinUrl: "", portfolioUrl: "" }));
  assert.equal(parsed.linkedinUrl, null);
  assert.equal(parsed.portfolioUrl, null);
});

test("current Experience allows null endDate", () => {
  const parsed = resumeExperienceSchema.safeParse({ jobTitle: "برنامه‌نویس", companyName: "شرکت", startDate: "2025-01-01", endDate: null, isCurrent: true, description: "" });
  assert.equal(parsed.success, true);
});

test("completed Experience requires an ordered endDate", () => {
  const base = { jobTitle: "برنامه‌نویس", companyName: "شرکت", startDate: "2025-01-01", isCurrent: false, description: "" };
  assert.equal(resumeExperienceSchema.safeParse({ ...base, endDate: null }).success, false);
  assert.equal(resumeExperienceSchema.safeParse({ ...base, endDate: "2024-12-01" }).success, false);
  assert.equal(resumeExperienceSchema.safeParse({ ...base, endDate: "2025-02-01" }).success, true);
});

test("Education follows the same current and date-order rules", () => {
  const base = { fieldOfStudy: "مهندسی کامپیوتر", institutionName: "دانشگاه", degree: "کارشناسی", startDate: "2022-09-01" };
  assert.equal(resumeEducationSchema.safeParse({ ...base, endDate: null, isCurrent: true }).success, true);
  assert.equal(resumeEducationSchema.safeParse({ ...base, endDate: null, isCurrent: false }).success, false);
  assert.equal(resumeEducationSchema.safeParse({ ...base, endDate: "2020-01-01", isCurrent: false }).success, false);
});

test("rejects duplicate Language names and invalid proficiency", () => {
  assert.equal(candidateResumeSchema.safeParse(validResume({ languages: [
    { name: "انگلیسی", proficiency: "advanced" },
    { name: " انگلیسی ", proficiency: "fluent" },
  ] })).success, false);
  assert.equal(candidateResumeSchema.safeParse(validResume({ languages: [{ name: "فرانسوی", proficiency: "expert" }] })).success, false);
});

test("ownership policy rejects another Candidate", () => {
  assert.equal(canCandidateUpdateResume("candidate-a", "candidate-a"), true);
  assert.equal(canCandidateUpdateResume("candidate-a", "candidate-b"), false);
});

test("persistence plan contains one Candidate parent and ordered nested replacements", () => {
  const values = candidateResumeSchema.parse(validResume({
    experiences: [{ jobTitle: "کارشناس", companyName: "الف", startDate: "2024-01-01", endDate: "2025-01-01", isCurrent: false, description: "توضیح" }],
    educations: [{ fieldOfStudy: "کامپیوتر", institutionName: "دانشگاه", degree: "کارشناسی", startDate: "2020-01-01", endDate: "2024-01-01", isCurrent: false }],
    languages: [{ name: "انگلیسی", proficiency: "advanced" }],
  }));
  const plan = buildResumePersistencePlan("candidate-a", values);
  assert.equal(plan.resume.candidateAccountId, "candidate-a");
  assert.equal("candidateAccountId" in plan.experiences[0], false);
  assert.equal(plan.experiences[0].sortOrder, 0);
  assert.equal(plan.educations[0].sortOrder, 0);
  assert.equal(plan.languages[0].sortOrder, 0);
});
