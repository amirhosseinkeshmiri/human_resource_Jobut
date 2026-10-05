import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_JOB_STATUS,
  canEditJob,
  createDraftJobValues,
  getPublishCreditDecision,
  getPublishEligibility,
  isJobOwnedByCompany,
  validateJobTitle,
  type JobStatus,
} from "./policy";

function applyPublicationPolicy(
  job: { companyId: string; status: JobStatus } | null,
  companyId: string,
  balance: number,
) {
  const eligibility = getPublishEligibility(job, companyId);
  if (eligibility !== "publishable") {
    return { outcome: eligibility, status: job?.status, debitAmount: 0, balance };
  }
  assert.ok(job);

  const credit = getPublishCreditDecision(balance);
  if (!credit.allowed) {
    return { outcome: "insufficient-credit", status: job.status, debitAmount: 0, balance };
  }

  return {
    outcome: "published",
    status: "published" as const,
    debitAmount: credit.debitAmount,
    balance: balance + credit.debitAmount,
  };
}

test("draft creation uses the authenticated company and defaults to draft", () => {
  assert.deepEqual(createDraftJobValues("company-a", "توسعه‌دهنده نرم‌افزار"), {
    companyId: "company-a", title: "توسعه‌دهنده نرم‌افزار", status: "draft",
  });
});

test("draft creation values contain no credit mutation", () => {
  assert.deepEqual(Object.keys(createDraftJobValues("company-a", "برنامه‌نویس")).sort(), ["companyId", "status", "title"]);
});

test("ownership checks reject another company's job", () => {
  assert.equal(isJobOwnedByCompany("company-b", "company-a"), false);
  assert.equal(isJobOwnedByCompany("company-a", "company-a"), true);
});

test("only draft jobs are editable", () => {
  assert.equal(canEditJob("draft"), true);
  assert.equal(canEditJob("published"), false);
  assert.equal(canEditJob("closed"), false);
});

test("title validation trims input and rejects empty values", () => {
  assert.deepEqual(validateJobTitle("  برنامه‌نویس  "), { ok: true, title: "برنامه‌نویس" });
  assert.equal(validateJobTitle("   ").ok, false);
});

test("active-job semantics remain published-only", () => {
  assert.equal(ACTIVE_JOB_STATUS, "published");
});

test("a Company-owned draft is publishable", () => {
  assert.equal(getPublishEligibility({ companyId: "company-a", status: "draft" }, "company-a"), "publishable");
});

test("published and closed jobs are not publishable", () => {
  assert.equal(getPublishEligibility({ companyId: "company-a", status: "published" }, "company-a"), "not-draft");
  assert.equal(getPublishEligibility({ companyId: "company-a", status: "closed" }, "company-a"), "not-draft");
});

test("publishing requires at least one credit and consumes exactly one", () => {
  assert.deepEqual(getPublishCreditDecision(1), { allowed: true, debitAmount: -1 });
  assert.deepEqual(getPublishCreditDecision(4), { allowed: true, debitAmount: -1 });
  assert.deepEqual(getPublishCreditDecision(0), { allowed: false, debitAmount: 0 });
});

test("insufficient credit leaves the draft and balance unchanged", () => {
  assert.deepEqual(applyPublicationPolicy({ companyId: "company-a", status: "draft" }, "company-a", 0), {
    outcome: "insufficient-credit", status: "draft", debitAmount: 0, balance: 0,
  });
});

test("failed ownership validation consumes no credit", () => {
  assert.deepEqual(applyPublicationPolicy({ companyId: "company-b", status: "draft" }, "company-a", 3), {
    outcome: "not-found", status: "draft", debitAmount: 0, balance: 3,
  });
});

test("a retry after publication consumes no additional credit", () => {
  const first = applyPublicationPolicy({ companyId: "company-a", status: "draft" }, "company-a", 2);
  assert.equal(first.status, "published");
  const retry = applyPublicationPolicy({ companyId: "company-a", status: "published" }, "company-a", first.balance);
  assert.equal(first.debitAmount, -1);
  assert.equal(retry.debitAmount, 0);
  assert.equal(retry.balance, 1);
});

test("serialized publications cannot spend the same final credit twice", () => {
  const first = applyPublicationPolicy({ companyId: "company-a", status: "draft" }, "company-a", 1);
  const second = applyPublicationPolicy({ companyId: "company-a", status: "draft" }, "company-a", first.balance);
  assert.equal(first.outcome, "published");
  assert.equal(first.balance, 0);
  assert.equal(second.outcome, "insufficient-credit");
  assert.equal(second.debitAmount, 0);
  assert.equal(second.balance, 0);
});
