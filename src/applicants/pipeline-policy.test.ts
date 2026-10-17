import assert from "node:assert/strict";
import test from "node:test";
import { APPLICATION_STATUSES } from "@/applications/status-policy";
import { canReviewHistoricalJob } from "./policy";
import {
  EMPLOYER_PIPELINE_CAPABILITIES,
  EMPLOYER_PIPELINE_LIMIT,
  PIPELINE_APPLICATION_FIELDS,
  PIPELINE_QUERY_SCOPE,
  buildPipelineColumns,
  canCompanyViewJobPipeline,
  emptyPipelineStatusCounts,
  isPipelineTruncated,
  pipelineApplicationDetailHref,
  type PipelineApplication,
} from "./pipeline-policy";

const applications: PipelineApplication[] = [
  { applicationId: "received-old", firstName: "علی", lastName: "رضایی", professionalTitle: "توسعه‌دهنده", city: "تهران", skills: ["TypeScript"], status: "received", createdAt: new Date("2026-10-01") },
  { applicationId: "interview", firstName: "سارا", lastName: "محمدی", professionalTitle: "طراح محصول", city: "شیراز", skills: ["Figma"], status: "interview", createdAt: new Date("2026-10-02") },
  { applicationId: "received-new", firstName: "مینا", lastName: "کریمی", professionalTitle: "مهندس نرم‌افزار", city: "تهران", skills: ["Node.js"], status: "received", createdAt: new Date("2026-10-03") },
];

test("Employer pipeline access requires the owned requested Job", () => {
  assert.equal(canCompanyViewJobPipeline({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", jobId: "job-1" }), true);
  assert.equal(canCompanyViewJobPipeline({ authenticatedCompanyId: "a", jobCompanyId: "b", requestedJobId: "job-1", jobId: "job-1" }), false);
  assert.equal(canCompanyViewJobPipeline({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-2", jobId: "job-1" }), false);
  assert.deepEqual(PIPELINE_QUERY_SCOPE, ["companyId", "jobId"]);
});

test("pipeline always represents exactly all five approved statuses", () => {
  const columns = buildPipelineColumns([], emptyPipelineStatusCounts());
  assert.deepEqual(columns.map((column) => column.status), APPLICATION_STATUSES);
  assert.deepEqual(columns.map((column) => column.label), ["دریافت‌شده", "در حال بررسی", "مصاحبه", "رد شده", "استخدام شده"]);
});

test("Applications group under the correct status with accurate counts", () => {
  const counts = { ...emptyPipelineStatusCounts(), received: 2, interview: 1 };
  const columns = buildPipelineColumns(applications, counts);
  assert.deepEqual(columns.find((column) => column.status === "received")?.applications.map((item) => item.applicationId), ["received-new", "received-old"]);
  assert.equal(columns.find((column) => column.status === "received")?.count, 2);
  assert.equal(columns.find((column) => column.status === "interview")?.count, 1);
  assert.equal(columns.find((column) => column.status === "hired")?.count, 0);
});

test("newest Applications are first within each status", () => {
  const received = buildPipelineColumns(applications, { ...emptyPipelineStatusCounts(), received: 2 })[0];
  assert.deepEqual(received.applications.map((item) => item.applicationId), ["received-new", "received-old"]);
});

test("zero-Application pipeline retains five empty columns", () => {
  const columns = buildPipelineColumns([], emptyPipelineStatusCounts());
  assert.equal(columns.length, 5);
  assert.equal(columns.every((column) => column.count === 0 && column.applications.length === 0), true);
});

test("draft, closed, and expired-published Job histories remain reviewable", () => {
  assert.equal(canReviewHistoricalJob("draft"), true);
  assert.equal(canReviewHistoricalJob("closed"), true);
  assert.equal(canReviewHistoricalJob("published"), true);
});

test("pipeline selects summary Resume fields without Candidate auth identifiers", () => {
  assert.deepEqual(PIPELINE_APPLICATION_FIELDS, ["applicationId", "firstName", "lastName", "professionalTitle", "city", "skills", "status", "createdAt"]);
  for (const privateField of ["candidateAccountId", "candidateResumeId", "email", "mobile", "employerNote", "statusHistory", "professionalSummary", "experiences", "educations", "languages"]) {
    assert.equal((PIPELINE_APPLICATION_FIELDS as readonly string[]).includes(privateField), false);
  }
});

test("board is bounded and reports truncated results", () => {
  assert.equal(EMPLOYER_PIPELINE_LIMIT, 100);
  assert.equal(isPipelineTruncated(100, 100), false);
  assert.equal(isPipelineTruncated(101, 100), true);
});

test("pipeline is read-only and detail links remain Job-scoped", () => {
  assert.deepEqual(EMPLOYER_PIPELINE_CAPABILITIES, ["view", "open-application-detail"]);
  assert.equal(EMPLOYER_PIPELINE_CAPABILITIES.some((capability) => capability.includes("mutat")), false);
  assert.equal(pipelineApplicationDetailHref("job-1", "application-1"), "/employer/jobs/job-1/applications/application-1");
});
