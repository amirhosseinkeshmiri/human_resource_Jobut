import assert from "node:assert/strict";
import test from "node:test";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "./validation";
import { formatJobSalary, isPublicJobActive, PUBLIC_JOB_DETAIL_FIELDS } from "./public-policy";

const now = new Date("2026-10-05T10:00:00.000Z");
const activeJob = {
  status: "published" as const,
  publishedAt: new Date("2026-10-01T10:00:00.000Z"),
  expiresAt: new Date("2026-10-31T10:00:00.000Z"),
};

test("published job with a future expiration is public", () => {
  assert.equal(isPublicJobActive(activeJob, now), true);
});

test("draft and closed jobs are not public", () => {
  assert.equal(isPublicJobActive({ ...activeJob, status: "draft" }, now), false);
  assert.equal(isPublicJobActive({ ...activeJob, status: "closed" }, now), false);
});

test("expired published job is not public", () => {
  assert.equal(isPublicJobActive({ ...activeJob, expiresAt: now }, now), false);
  assert.equal(isPublicJobActive({ ...activeJob, expiresAt: new Date(now.getTime() - 1) }, now), false);
});

test("published job without publication timestamps is not public", () => {
  assert.equal(isPublicJobActive({ ...activeJob, expiresAt: null }, now), false);
  assert.equal(isPublicJobActive({ ...activeJob, publishedAt: null }, now), false);
});

test("public detail field allowlist contains no private Company or Employer data", () => {
  assert.equal(PUBLIC_JOB_DETAIL_FIELDS.includes("companyName"), true);
  assert.equal(PUBLIC_JOB_DETAIL_FIELDS.includes("companyLogoUrl"), true);
  for (const privateField of ["companyId", "employerAccountId", "email", "mobile", "employerNote", "statusHistory", "creditBalance", "packagePurchases"]) {
    assert.equal((PUBLIC_JOB_DETAIL_FIELDS as readonly string[]).includes(privateField), false);
  }
});

test("formats negotiable and bounded salary in Persian", () => {
  assert.equal(formatJobSalary({ salaryNegotiable: true, salaryMin: null, salaryMax: null }), "حقوق توافقی");
  assert.equal(formatJobSalary({ salaryNegotiable: false, salaryMin: 20_000_000, salaryMax: 35_000_000 }), "۲۰٬۰۰۰٬۰۰۰ تا ۳۵٬۰۰۰٬۰۰۰ تومان");
});

test("enum presentation mappings use the approved Persian labels", () => {
  assert.deepEqual(workplaceTypeLabels, { onsite: "حضوری", remote: "دورکاری", hybrid: "ترکیبی" });
  assert.deepEqual(employmentTypeLabels, { full_time: "تمام‌وقت", part_time: "پاره‌وقت", project: "پروژه‌ای", internship: "کارآموزی" });
  assert.deepEqual(seniorityLevelLabels, { intern: "کارآموز", junior: "جونیور", mid_level: "میدل‌لول", senior: "سنیور", lead: "لید" });
});
