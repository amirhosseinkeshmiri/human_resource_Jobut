import assert from "node:assert/strict";
import test from "node:test";
import { canIssueAdminChallenge } from "@/admin-auth/policy";
import {
  ADMIN_JOBS_PAGE_SIZE,
  getAdminJobPageCount,
  getAdminJobPresentationStatus,
  isJobId,
  matchesAdminJobSearch,
  parseAdminJobParams,
} from "./jobs-policy";

const now = new Date("2026-06-15T12:00:00.000Z");

test("approved draft, active, expired, and closed filters are parsed", () => {
  for (const status of ["draft", "published_active", "published_expired", "closed"] as const) {
    assert.equal(parseAdminJobParams({ status }).status, status);
  }
  assert.equal(parseAdminJobParams({ status: "approved" }).status, "all");
});

test("published expiration is derived without mutating the database status", () => {
  assert.equal(getAdminJobPresentationStatus({ status: "draft", publishedAt: null, expiresAt: null }, now), "draft");
  assert.equal(getAdminJobPresentationStatus({ status: "closed", publishedAt: now, expiresAt: now }, now), "closed");
  assert.equal(getAdminJobPresentationStatus({ status: "published", publishedAt: new Date("2026-06-01"), expiresAt: new Date("2026-06-20") }, now), "published_active");
  assert.equal(getAdminJobPresentationStatus({ status: "published", publishedAt: new Date("2026-06-01"), expiresAt: now }, now), "published_expired");
});

test("published historical jobs with missing timestamps remain a safe incomplete state", () => {
  assert.equal(getAdminJobPresentationStatus({ status: "published", publishedAt: null, expiresAt: null }, now), "published_incomplete");
  assert.equal(getAdminJobPresentationStatus({ status: "published", publishedAt: now, expiresAt: null }, now), "published_incomplete");
});

test("search matches only title or Company name", () => {
  const job = { title: "مهندس نرم‌افزار", companyName: "دانش‌بنیان البرز" };
  assert.equal(matchesAdminJobSearch(job, "نرم‌افزار"), true);
  assert.equal(matchesAdminJobSearch(job, "البرز"), true);
  assert.equal(matchesAdminJobSearch(job, "تهران"), false);
});

test("created, published, and expiration sorts are allowlisted", () => {
  for (const sort of ["created_desc", "created_asc", "published_desc", "published_asc", "expires_asc", "expires_desc"] as const) {
    assert.equal(parseAdminJobParams({ sort }).sort, sort);
  }
  assert.equal(parseAdminJobParams({ sort: "salary_desc" }).sort, "created_desc");
});

test("pagination is bounded and produces stable page counts", () => {
  assert.equal(parseAdminJobParams({ page: "-2" }).page, 1);
  assert.equal(getAdminJobPageCount(0), 1);
  assert.equal(getAdminJobPageCount(ADMIN_JOBS_PAGE_SIZE + 1), 2);
});

test("unknown or malformed Job IDs are rejected before detail lookup", () => {
  assert.equal(isJobId("unknown-job"), false);
  assert.equal(isJobId("123e4567-e89b-12d3-a456-426614174000"), true);
});

test("Admin Job access reuses the isolated Admin policy", () => {
  assert.equal(canIssueAdminChallenge("admin-id"), true);
  assert.equal(canIssueAdminChallenge(null), false);
});
