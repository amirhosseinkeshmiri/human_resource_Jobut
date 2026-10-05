import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeJobDescription } from "./description";
import { getPublicationTimestamps, getPublishCreditDecision, getPublishEligibility } from "./policy";
import { jobPostFormSchema } from "./validation";

const validJob = {
  title: "  توسعه‌دهنده نرم‌افزار  ",
  workplaceType: "hybrid",
  employmentType: "full_time",
  location: " تهران ",
  seniorityLevel: "senior",
  salaryMin: 30_000_000,
  salaryMax: 50_000_000,
  salaryNegotiable: false,
  requiredSkills: [" TypeScript ", "React"],
  description: "<p><strong>مسئولیت‌ها</strong></p><ul><li>توسعه محصول</li></ul>",
} as const;

test("accepts and normalizes complete approved JobPost data", () => {
  const result = jobPostFormSchema.parse(validJob);
  assert.equal(result.title, "توسعه‌دهنده نرم‌افزار");
  assert.equal(result.location, "تهران");
  assert.deepEqual(result.requiredSkills, ["TypeScript", "React"]);
});

test("rejects a missing required field", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, location: "" }).success, false);
});

test("rejects invalid enum values", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, workplaceType: "office" }).success, false);
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, employmentType: "contract" }).success, false);
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, seniorityLevel: "manager" }).success, false);
});

test("rejects salary maximum below minimum", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, salaryMin: 50, salaryMax: 40 }).success, false);
});

test("allows negotiable salary without minimum or maximum", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, salaryNegotiable: true, salaryMin: null, salaryMax: null }).success, true);
});

test("rejects non-negotiable salary with a missing bound", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, salaryMin: null }).success, false);
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, salaryMax: null }).success, false);
});

test("requires one to ten unique skills", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, requiredSkills: [] }).success, false);
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, requiredSkills: Array.from({ length: 11 }, (_, index) => `مهارت ${index}`) }).success, false);
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, requiredSkills: ["React", " react "] }).success, false);
});

test("rejects an effectively empty description", () => {
  assert.equal(jobPostFormSchema.safeParse({ ...validJob, description: "<p><br></p>" }).success, false);
});

test("sanitizes unsafe description HTML to the approved formatting set", () => {
  const sanitized = sanitizeJobDescription('<p onclick="evil()"><strong>شرح</strong><script>alert(1)</script><a href="javascript:evil()">پیوند</a></p>');
  assert.equal(sanitized, "<p><strong>شرح</strong>پیوند</p>");
});

test("incomplete historical drafts fail completeness while complete drafts reach publication policy", () => {
  assert.equal(jobPostFormSchema.safeParse({ title: "پیش‌نویس قدیمی" }).success, false);
  assert.equal(jobPostFormSchema.safeParse(validJob).success, true);
  assert.equal(getPublishEligibility({ companyId: "company-a", status: "draft" }, "company-a"), "publishable");
});

test("expiration is exactly thirty days after publication", () => {
  const publishedAt = new Date("2026-01-01T12:00:00.000Z");
  const timestamps = getPublicationTimestamps(publishedAt);
  assert.equal(timestamps.publishedAt, publishedAt);
  assert.equal(timestamps.expiresAt.toISOString(), "2026-01-31T12:00:00.000Z");
});

test("publication failure consumes zero credits", () => {
  assert.deepEqual(getPublishCreditDecision(0), { allowed: false, debitAmount: 0 });
});
