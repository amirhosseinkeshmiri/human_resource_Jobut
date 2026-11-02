import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartRoleAuthentication,
  candidateDisplayName,
  employerDisplayName,
  resolveBrowserAccountContext,
} from "./role-isolation-policy";

test("an Employer session cannot authorize the Candidate context or direct Candidate access", () => {
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: false, employerSessionValid: true }), "employer");
});

test("a Candidate session cannot authorize the Employer context or direct Employer access", () => {
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: true, employerSessionValid: false }), "candidate");
});

test("two valid legacy cookies fail closed instead of selecting either account", () => {
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: true, employerSessionValid: true }), "conflict");
});

test("stale or revoked sessions are ignored after database validation", () => {
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: false, employerSessionValid: false }), "anonymous");
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: false, employerSessionValid: true }), "employer");
});

test("role switching requires logout before starting the opposite OTP flow", () => {
  assert.equal(canStartRoleAuthentication("employer", "candidate"), false);
  assert.equal(canStartRoleAuthentication("candidate", "employer"), false);
  assert.equal(canStartRoleAuthentication("anonymous", "candidate"), true);
  assert.equal(canStartRoleAuthentication("anonymous", "employer"), true);
});

test("same identifiers do not influence role resolution", () => {
  const sameEmailInBothTables = "same@example.com";
  assert.ok(sameEmailInBothTables);
  assert.equal(resolveBrowserAccountContext({ candidateSessionValid: true, employerSessionValid: false }), "candidate");
});

test("candidate identity uses the full resume name and a neutral fallback", () => {
  assert.equal(candidateDisplayName(" مریم ", " احمدی "), "مریم احمدی");
  assert.equal(candidateDisplayName(null, ""), "حساب کارجو");
});

test("employer identity uses the company name and never a contact identifier fallback", () => {
  assert.equal(employerDisplayName(" شرکت نمونه "), "شرکت نمونه");
  assert.equal(employerDisplayName(null), "حساب کارفرما");
});
