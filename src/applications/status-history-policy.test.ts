import assert from "node:assert/strict";
import test from "node:test";
import { applicationStatusLabels } from "./status-policy";
import {
  APPLICATION_STATUS_HISTORY_FIELDS,
  APPLICATION_STATUS_HISTORY_LIMIT,
  APPLICATION_SUBMISSION_TIMELINE_LABEL,
  STATUS_TRANSITION_TRANSACTION_STEPS,
  buildApplicationStatusHistoryInsert,
  orderStatusHistoryOldestFirst,
  planApplicationStatusTransition,
  shouldAppendApplicationStatusHistory,
} from "./status-history-policy";

test("successful approved transitions plan exactly one history row", () => {
  for (const [fromStatus, toStatus] of [
    ["received", "reviewing"],
    ["received", "rejected"],
    ["reviewing", "interview"],
    ["interview", "hired"],
  ] as const) {
    const plan = planApplicationStatusTransition(fromStatus, toStatus);
    assert.equal(plan.decision, "update");
    assert.deepEqual("history" in plan ? plan.history : null, { fromStatus, toStatus });
    assert.equal(shouldAppendApplicationStatusHistory(plan.decision, true), true);
  }
});

test("same-status, invalid, stale, and terminal attempts create no history", () => {
  assert.equal(planApplicationStatusTransition("reviewing", "reviewing").decision, "noop");
  assert.equal(planApplicationStatusTransition("received", "interview").decision, "invalid");
  assert.equal(planApplicationStatusTransition("hired", "reviewing").decision, "invalid");
  assert.equal(planApplicationStatusTransition("rejected", "received").decision, "invalid");
  assert.equal(shouldAppendApplicationStatusHistory("noop", true), false);
  assert.equal(shouldAppendApplicationStatusHistory("invalid", true), false);
  assert.equal(shouldAppendApplicationStatusHistory("update", false), false);
});

test("history insert records the actual prior and requested successful statuses", () => {
  assert.deepEqual(
    buildApplicationStatusHistoryInsert("application-1", "reviewing", "interview"),
    { jobApplicationId: "application-1", fromStatus: "reviewing", toStatus: "interview" },
  );
});

test("status update and history append are one ordered transaction plan", () => {
  assert.deepEqual(STATUS_TRANSITION_TRANSACTION_STEPS, ["verify-current-status", "conditional-status-update", "append-history"]);
  assert.equal(STATUS_TRANSITION_TRANSACTION_STEPS.indexOf("append-history") > STATUS_TRANSITION_TRANSACTION_STEPS.indexOf("conditional-status-update"), true);
  assert.deepEqual(APPLICATION_STATUS_HISTORY_FIELDS, ["id", "jobApplicationId", "fromStatus", "toStatus", "changedAt"]);
});

test("timeline orders oldest first with a stable ID tie-breaker", () => {
  const sameTime = new Date("2026-10-17T10:00:00.000Z");
  const rows = [
    { id: "b", changedAt: sameTime },
    { id: "c", changedAt: new Date("2026-10-18T10:00:00.000Z") },
    { id: "a", changedAt: sameTime },
  ];
  assert.deepEqual(orderStatusHistoryOldestFirst(rows).map((row) => row.id), ["a", "b", "c"]);
  assert.deepEqual(orderStatusHistoryOldestFirst([]), []);
  assert.equal(APPLICATION_STATUS_HISTORY_LIMIT, 100);
});

test("timeline presentation uses centralized Persian labels and submission context", () => {
  assert.equal(applicationStatusLabels.received, "دریافت‌شده");
  assert.equal(applicationStatusLabels.interview, "مصاحبه");
  assert.equal(APPLICATION_SUBMISSION_TIMELINE_LABEL, "درخواست ارسال شد");
});
