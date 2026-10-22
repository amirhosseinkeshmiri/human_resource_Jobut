import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJobOpportunityPresentation,
  getCompanyLogoFallback,
  getVisibleJobSkills,
} from "./card-presentation";
import { PUBLIC_JOBS_LABEL, PUBLIC_JOBS_ROUTE } from "./public-copy";
import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "./validation";

const job = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "توسعه‌دهنده ارشد فرانت‌اند",
  companyName: "شرکت نمونه",
  companyLogoUrl: null,
  industryName: "فناوری اطلاعات",
  location: "تهران",
  workplaceType: "hybrid" as const,
  employmentType: "full_time" as const,
  seniorityLevel: "senior" as const,
  salaryMin: 20_000_000,
  salaryMax: 30_000_000,
  salaryNegotiable: false,
  publishedAt: new Date("2026-10-20T00:00:00.000Z"),
};

test("public discovery terminology keeps the /jobs route", () => {
  assert.equal(PUBLIC_JOBS_LABEL, "فرصت‌های شغلی");
  assert.equal(PUBLIC_JOBS_ROUTE, "/jobs");
});

test("shared Job card presentation includes title, Company, centralized metadata, and detail link", () => {
  const presentation = buildJobOpportunityPresentation(job, ["React"], []);
  assert.equal(presentation.title, job.title);
  assert.equal(presentation.companyName, job.companyName);
  assert.equal(presentation.detailHref, `/jobs/${job.id}`);
  assert.deepEqual(presentation.metadata, [
    "تهران",
    workplaceTypeLabels.hybrid,
    employmentTypeLabels.full_time,
    seniorityLevelLabels.senior,
  ]);
  assert.equal(getCompanyLogoFallback(job.companyName), "ش");
  assert.equal(getCompanyLogoFallback(" "), "ج");
});

test("shared Job card shows at most three skills and the correct remainder", () => {
  assert.deepEqual(getVisibleJobSkills(["۱", "۲", "۳", "۴", "۵"]), {
    visible: ["۱", "۲", "۳"],
    remaining: 2,
  });
});

test("recommended presentation contains only supplied true reasons and no score", () => {
  const presentation = buildJobOpportunityPresentation(job, ["React"], ["محل موردنظر شما"]);
  assert.deepEqual(presentation.reasons, ["محل موردنظر شما"]);
  assert.equal("score" in presentation, false);
  assert.equal("description" in presentation, false);
});
