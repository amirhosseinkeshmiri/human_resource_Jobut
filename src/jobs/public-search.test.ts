import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicJobsHref,
  getPublicJobsOffset,
  getPublicJobsPageCount,
  hasPublicJobFilters,
  matchesPublicJobFilters,
  parsePublicJobFilters,
  PUBLIC_JOB_LOCATION_MAX_LENGTH,
  PUBLIC_JOB_QUERY_MAX_LENGTH,
  PUBLIC_JOBS_CLEAR_URL,
  PUBLIC_JOBS_PAGE_SIZE,
} from "./public-search";

const job = {
  title: "توسعه‌دهنده Frontend",
  companyName: "شرکت داده‌پرداز",
  location: "تهران",
  workplace: "hybrid" as const,
  employment: "full_time" as const,
  seniority: "mid_level" as const,
};

test("no filters returns the public discovery set", () => {
  const filters = parsePublicJobFilters({});
  assert.equal(hasPublicJobFilters(filters), false);
  assert.equal(matchesPublicJobFilters(job, filters), true);
});

test("keyword search matches only title or Company name case-insensitively", () => {
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ q: "frontend" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ q: "داده‌پرداز" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ q: "شیراز" })), false);
});

test("location uses normalized exact matching", () => {
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ location: "  تهران  " })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ location: "تهر" })), false);
});

test("all approved workplace filters parse and match exactly", () => {
  assert.equal(parsePublicJobFilters({ workplace: "onsite" }).workplace, "onsite");
  assert.equal(parsePublicJobFilters({ workplace: "remote" }).workplace, "remote");
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ workplace: "hybrid" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ workplace: "remote" })), false);
});

test("employment and seniority filters match exactly", () => {
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ employment: "full_time" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ employment: "internship" })), false);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ seniority: "mid_level" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ seniority: "lead" })), false);
});

test("combined filters use AND semantics", () => {
  const matching = parsePublicJobFilters({ q: "frontend", location: "تهران", workplace: "hybrid", employment: "full_time", seniority: "mid_level" });
  assert.equal(matchesPublicJobFilters(job, matching), true);
  assert.equal(matchesPublicJobFilters(job, { ...matching, location: "شیراز" }), false);
});

test("invalid enums are safely ignored", () => {
  const filters = parsePublicJobFilters({ workplace: "virtual", employment: "contract", seniority: "principal" });
  assert.equal(filters.workplace, null);
  assert.equal(filters.employment, null);
  assert.equal(filters.seniority, null);
});

test("keyword and location inputs are normalized and bounded", () => {
  assert.equal(parsePublicJobFilters({ q: "  front   end  ", location: "  تهران  " }).q, "front end");
  assert.equal(parsePublicJobFilters({ q: "x".repeat(PUBLIC_JOB_QUERY_MAX_LENGTH + 1) }).q, "");
  assert.equal(parsePublicJobFilters({ location: "x".repeat(PUBLIC_JOB_LOCATION_MAX_LENGTH + 1) }).location, "");
});

test("pagination uses twenty rows with safe page normalization", () => {
  assert.equal(PUBLIC_JOBS_PAGE_SIZE, 20);
  assert.equal(parsePublicJobFilters({}).page, 1);
  assert.equal(parsePublicJobFilters({ page: "2" }).page, 2);
  assert.equal(parsePublicJobFilters({ page: "0" }).page, 1);
  assert.equal(parsePublicJobFilters({ page: "-2" }).page, 1);
  assert.equal(parsePublicJobFilters({ page: "2.5" }).page, 1);
  assert.equal(getPublicJobsOffset(1), 0);
  assert.equal(getPublicJobsOffset(2), 20);
  assert.equal(getPublicJobsPageCount(41), 3);
});

test("pagination URLs preserve all active filters", () => {
  const filters = parsePublicJobFilters({ q: "frontend", location: "تهران", workplace: "remote", employment: "full_time", seniority: "senior" });
  assert.equal(buildPublicJobsHref(filters, 2), "/jobs?q=frontend&location=%D8%AA%D9%87%D8%B1%D8%A7%D9%86&workplace=remote&employment=full_time&seniority=senior&page=2");
  assert.equal(buildPublicJobsHref(filters, 1).includes("page="), false);
});

test("clear filters uses the base public Jobs URL", () => {
  assert.equal(PUBLIC_JOBS_CLEAR_URL, "/jobs");
  assert.equal(buildPublicJobsHref(parsePublicJobFilters({}), 1), "/jobs");
});
