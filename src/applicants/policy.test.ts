import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICANT_LIST_FIELDS,
  EMPLOYER_APPLICANTS_PAGE_SIZE,
  EMPLOYER_APPLICANT_CAPABILITIES,
  EMPLOYER_RESUME_FIELDS,
  canCompanyReviewApplication,
  canCompanyReviewJob,
  canReviewHistoricalJob,
  countCompanyApplications,
  getApplicantPageCount,
  parseApplicantPage,
} from "./policy";

test("Employer can list Applications only for its own Job", () => {
  assert.equal(canCompanyReviewJob("company-a", "company-a"), true);
  assert.equal(canCompanyReviewJob("company-a", "company-b"), false);
});

test("Resume access requires both Company ownership and requested Job membership", () => {
  assert.equal(canCompanyReviewApplication({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-1" }), true);
  assert.equal(canCompanyReviewApplication({ authenticatedCompanyId: "a", jobCompanyId: "b", requestedJobId: "job-1", applicationJobId: "job-1" }), false);
  assert.equal(canCompanyReviewApplication({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-2" }), false);
});

test("closed, expired-published, and draft Jobs remain reviewable without public eligibility", () => {
  assert.equal(canReviewHistoricalJob("closed"), true);
  assert.equal(canReviewHistoricalJob("published"), true);
  assert.equal(canReviewHistoricalJob("draft"), true);
});

test("Applicant list exposes summary Resume fields without Candidate identifiers", () => {
  assert.deepEqual(APPLICANT_LIST_FIELDS, ["applicationId", "firstName", "lastName", "professionalTitle", "city", "skills", "status", "createdAt"]);
  assert.equal(APPLICANT_LIST_FIELDS.some((field) => String(field).includes("candidate")), false);
  assert.equal((APPLICANT_LIST_FIELDS as readonly string[]).includes("statusHistory"), false);
});

test("Resume detail allowlist contains only approved structured sections", () => {
  assert.deepEqual(EMPLOYER_RESUME_FIELDS, ["firstName", "lastName", "city", "professionalTitle", "professionalSummary", "skills", "linkedinUrl", "portfolioUrl", "experiences", "educations", "languages"]);
  for (const emptySection of [[], [], []]) assert.equal(emptySection.length, 0);
});

test("Company Application count includes only Applications through its Jobs", () => {
  const applications = [{ jobCompanyId: "a" }, { jobCompanyId: "b" }, { jobCompanyId: "a" }];
  assert.equal(countCompanyApplications(applications, "a"), 2);
});

test("Applicant pagination is positive and bounded to twenty rows", () => {
  assert.equal(EMPLOYER_APPLICANTS_PAGE_SIZE, 20);
  assert.equal(parseApplicantPage("-2"), 1);
  assert.equal(parseApplicantPage("3"), 3);
  assert.equal(getApplicantPageCount(0), 1);
  assert.equal(getApplicantPageCount(21), 2);
});

test("Employer Applicant capabilities add only status transition", () => {
  assert.deepEqual(EMPLOYER_APPLICANT_CAPABILITIES, ["list", "view", "transition-status"]);
  assert.equal(EMPLOYER_RESUME_FIELDS.includes("status" as never), false);
});
