import assert from "node:assert/strict";
import test from "node:test";
import {
  getCandidateApplicationPublicIdentity,
  getCandidateVisibleStatusLabel,
  presentCandidateStatusHistory,
} from "./candidate-history-presentation";

const later = new Date("2026-10-02T10:00:00.000Z");
const earlier = new Date("2026-10-01T10:00:00.000Z");

test("Candidate status history is chronological and distinguishes withdrawal", () => {
  const result = presentCandidateStatusHistory([
    { id: "b", fromStatus: "reviewing", toStatus: "withdrawn", changedAt: later },
    { id: "a", fromStatus: "received", toStatus: "reviewing", changedAt: earlier },
  ], true);

  assert.deepEqual(result.map((item) => item.id), ["a", "b"]);
  assert.equal(result[0]?.actorLabel, "به‌روزرسانی توسط کارفرما");
  assert.equal(result[1]?.actorLabel, "انصراف توسط شما");
  assert.equal(result[1]?.changedBy, "candidate");
});

test("withdrawn copy is not exposed while its feature is disabled", () => {
  const [item] = presentCandidateStatusHistory([
    { id: "a", fromStatus: "received", toStatus: "withdrawn", changedAt: earlier },
  ], false);
  assert.equal(getCandidateVisibleStatusLabel("withdrawn", false), "وضعیت نهایی");
  assert.equal(item?.toLabel, "وضعیت نهایی");
  assert.equal(item?.actorLabel, "به‌روزرسانی توسط کارفرما");
});

test("missing history remains empty and no events are fabricated", () => {
  assert.deepEqual(presentCandidateStatusHistory([], true), []);
});

test("public application identity handles unavailable Job data without private fields", () => {
  assert.deepEqual(getCandidateApplicationPublicIdentity({ jobTitle: " ", companyName: null }), {
    jobTitle: "فرصت شغلی دیگر در دسترس نیست",
    companyName: "نام شرکت در دسترس نیست",
  });
});
