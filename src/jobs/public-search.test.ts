import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicJobsHref,
  comparePublicJobSalary,
  getPublicJobsOffset,
  getPublicJobsPageCount,
  hasPublicJobFilters,
  matchesPublicJobFilters,
  parsePublicJobFilters,
  PUBLIC_JOB_LOCATION_MAX_LENGTH,
  PUBLIC_JOB_QUERY_MAX_LENGTH,
  PUBLIC_JOB_SALARY_MAX,
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
  salaryMin: 20_000_000,
  salaryMax: 35_000_000,
  salaryNegotiable: false,
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

test("minimum salary matches the upper boundary of disclosed ranges", () => {
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ minSalary: "35000000" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ minSalary: "35000001" })), false);
  assert.equal(matchesPublicJobFilters({ ...job, salaryNegotiable: true, salaryMin: null, salaryMax: null }, parsePublicJobFilters({ minSalary: "1" })), false);
});

test("salary type separates fixed ranges from negotiable compensation", () => {
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ salaryType: "fixed" })), true);
  assert.equal(matchesPublicJobFilters(job, parsePublicJobFilters({ salaryType: "negotiable" })), false);
  const negotiable = { ...job, salaryNegotiable: true, salaryMin: null, salaryMax: null };
  assert.equal(matchesPublicJobFilters(negotiable, parsePublicJobFilters({ salaryType: "negotiable", minSalary: "20000000" })), true);
  assert.equal(parsePublicJobFilters({ salaryType: "negotiable", minSalary: "20000000" }).minSalary, null);
});

test("invalid, negative, decimal, and oversized salaries fail safely", () => {
  for (const minSalary of ["-1", "1.5", "12x", String(PUBLIC_JOB_SALARY_MAX + 1), "9".repeat(40)]) {
    assert.equal(parsePublicJobFilters({ minSalary }).minSalary, null);
  }
  assert.equal(parsePublicJobFilters({ minSalary: "0" }).minSalary, 0);
  assert.equal(parsePublicJobFilters({ minSalary: String(PUBLIC_JOB_SALARY_MAX) }).minSalary, PUBLIC_JOB_SALARY_MAX);
});

test("salary sorting uses range minimum then maximum and always places negotiable jobs last", () => {
  const low = { id: "a", salaryMin: 10, salaryMax: 20, salaryNegotiable: false };
  const high = { id: "b", salaryMin: 30, salaryMax: 40, salaryNegotiable: false };
  const negotiable = { id: "c", salaryMin: null, salaryMax: null, salaryNegotiable: true };
  assert.deepEqual([high, negotiable, low].sort((a, b) => comparePublicJobSalary(a, b, "asc")).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual([low, negotiable, high].sort((a, b) => comparePublicJobSalary(a, b, "desc")).map((item) => item.id), ["b", "a", "c"]);
});

test("salary sorting has a deterministic ID tie-breaker", () => {
  const first = { id: "00000000-0000-4000-8000-000000000001", salaryMin: 20, salaryMax: 30, salaryNegotiable: false };
  const second = { ...first, id: "00000000-0000-4000-8000-000000000002" };
  assert.deepEqual([first, second].sort((a, b) => comparePublicJobSalary(a, b, "asc")).map((item) => item.id), [second.id, first.id]);
});

test("invalid enums are safely ignored", () => {
  const filters = parsePublicJobFilters({ workplace: "virtual", employment: "contract", seniority: "principal", salaryType: "hidden", sort: "popular" });
  assert.equal(filters.workplace, null);
  assert.equal(filters.employment, null);
  assert.equal(filters.seniority, null);
  assert.equal(filters.salaryType, null);
  assert.equal(filters.sort, "newest");
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
  const filters = parsePublicJobFilters({ q: "frontend", location: "تهران", workplace: "remote", employment: "full_time", seniority: "senior", salaryType: "fixed", minSalary: "25000000", sort: "salary_desc" });
  assert.equal(buildPublicJobsHref(filters, 2), "/jobs?q=frontend&location=%D8%AA%D9%87%D8%B1%D8%A7%D9%86&workplace=remote&employment=full_time&seniority=senior&salaryType=fixed&minSalary=25000000&sort=salary_desc&page=2");
  assert.equal(buildPublicJobsHref(filters, 1).includes("page="), false);
});

test("clear filters uses the base public Jobs URL", () => {
  assert.equal(PUBLIC_JOBS_CLEAR_URL, "/jobs");
  assert.equal(buildPublicJobsHref(parsePublicJobFilters({}), 1), "/jobs");
});
