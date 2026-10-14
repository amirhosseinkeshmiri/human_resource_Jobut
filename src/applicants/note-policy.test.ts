import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATE_APPLICATION_HISTORY_FIELDS } from "@/applications/policy";
import {
  EMPLOYER_NOTE_BROWSER_FIELDS,
  EMPLOYER_NOTE_MAX_LENGTH,
  EMPLOYER_NOTE_UPDATE_FIELDS,
  buildEmployerNoteUpdate,
  canCompanyEditEmployerNote,
  validateEmployerNote,
} from "./note-policy";

test("Employer note accepts Persian and multiline plain text", () => {
  assert.deepEqual(validateEmployerNote("برای مصاحبه فنی مناسب است."), { success: true, data: "برای مصاحبه فنی مناسب است." });
  assert.deepEqual(validateEmployerNote("خط اول\nخط دوم"), { success: true, data: "خط اول\nخط دوم" });
});

test("Employer note trims surrounding whitespace and empty content becomes null", () => {
  assert.deepEqual(validateEmployerNote("  نکته داخلی  \n"), { success: true, data: "نکته داخلی" });
  assert.deepEqual(validateEmployerNote(" \n\t "), { success: true, data: null });
});

test("Employer note rejects oversized input", () => {
  assert.equal(validateEmployerNote("x".repeat(EMPLOYER_NOTE_MAX_LENGTH + 1)).success, false);
});

test("HTML-like input remains literal plain text data", () => {
  const literal = "<strong>داخلی</strong><script>alert(1)</script>";
  assert.deepEqual(validateEmployerNote(literal), { success: true, data: literal });
});

test("note ownership requires authenticated Company, owned Job, and requested Application Job", () => {
  assert.equal(canCompanyEditEmployerNote({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-1" }), true);
  assert.equal(canCompanyEditEmployerNote({ authenticatedCompanyId: null, jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-1" }), false);
  assert.equal(canCompanyEditEmployerNote({ authenticatedCompanyId: "a", jobCompanyId: "b", requestedJobId: "job-1", applicationJobId: "job-1" }), false);
  assert.equal(canCompanyEditEmployerNote({ authenticatedCompanyId: "a", jobCompanyId: "a", requestedJobId: "job-1", applicationJobId: "job-2" }), false);
  assert.deepEqual(EMPLOYER_NOTE_BROWSER_FIELDS, ["jobId", "applicationId", "note"]);
});

test("note persistence replaces or clears only employerNote", () => {
  assert.deepEqual(EMPLOYER_NOTE_UPDATE_FIELDS, ["employerNote"]);
  assert.deepEqual(buildEmployerNoteUpdate("جدید"), { employerNote: "جدید" });
  assert.deepEqual(buildEmployerNoteUpdate(null), { employerNote: null });
  const application = { status: "reviewing" as const, employerNote: "قدیمی" };
  assert.deepEqual({ ...application, ...buildEmployerNoteUpdate("جدید") }, { status: "reviewing", employerNote: "جدید" });
  assert.deepEqual({ ...application, status: "interview" as const }, { status: "interview", employerNote: "قدیمی" });
});

test("Candidate Application history cannot expose Employer notes", () => {
  assert.equal((CANDIDATE_APPLICATION_HISTORY_FIELDS as readonly string[]).includes("employerNote"), false);
  assert.equal((CANDIDATE_APPLICATION_HISTORY_FIELDS as readonly string[]).includes("applicationStatus"), true);
});
