import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_JOB_STATUS, canEditJob, createDraftJobValues, isJobOwnedByCompany, validateJobTitle } from "./policy";

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
