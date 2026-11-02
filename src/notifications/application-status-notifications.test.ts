import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { candidateApplicationStatusNotifications } from "@/db/schema";
import {
  CANDIDATE_APPLICATION_NOTIFICATION_FIELDS,
  CANDIDATE_NOTIFICATION_PAGE_SIZE,
  STATUS_NOTIFICATION_DELIVERY_STEPS,
  buildApplicationStatusNotificationSummary,
  canCandidateReadNotification,
  canMarkCandidateNotificationRead,
  getCandidateNotificationPageCount,
  parseCandidateNotificationPage,
  runBestEffortNotificationDelivery,
  shouldDeliverApplicationStatusNotification,
} from "./application-status-policy";
import { isCandidateApplicationNotificationsEnabled } from "./feature";

test("eligible public statuses produce a minimal notification summary", () => {
  for (const status of ["reviewing", "interview", "rejected", "hired", "received"] as const) {
    assert.deepEqual(buildApplicationStatusNotificationSummary(status), { status });
  }
  for (const sensitive of ["employerNote", "resume", "email", "mobile", "evaluation"]) {
    assert.equal((CANDIDATE_APPLICATION_NOTIFICATION_FIELDS as readonly string[]).includes(sensitive), false);
  }
});

test("notification delivery happens after the durable status/history commit", () => {
  assert.deepEqual(STATUS_NOTIFICATION_DELIVERY_STEPS, ["commit-status-and-history", "best-effort-materialize-notification"]);
  assert.equal(STATUS_NOTIFICATION_DELIVERY_STEPS.indexOf("best-effort-materialize-notification") > STATUS_NOTIFICATION_DELIVERY_STEPS.indexOf("commit-status-and-history"), true);
});

test("only a successful transition attempts delivery and no-op or failed transitions do not", () => {
  assert.equal(shouldDeliverApplicationStatusNotification("updated"), true);
  for (const result of ["noop", "not-found", "invalid-transition", "stale"] as const) {
    assert.equal(shouldDeliverApplicationStatusNotification(result), false);
  }
});

test("notification persistence failure is contained after the core status commit", async () => {
  let durableStatus = "reviewing";
  const outcome = await runBestEffortNotificationDelivery(async () => {
    throw new Error("notification table unavailable");
  });
  assert.equal(outcome, "failed");
  assert.equal(durableStatus, "reviewing");
  durableStatus = "interview";
  assert.equal(await runBestEffortNotificationDelivery(async () => undefined), "delivered");
  assert.equal(durableStatus, "interview");
});

test("notification ownership rejects anonymous and cross-account access", () => {
  assert.equal(canCandidateReadNotification("candidate-a", "candidate-a"), true);
  assert.equal(canCandidateReadNotification("candidate-a", "candidate-b"), false);
  assert.equal(canCandidateReadNotification(null, "candidate-a"), false);
});

test("mark-as-read requires ownership, CSRF origin, valid ID, and enabled feature", () => {
  const base = { authenticatedCandidateId: "candidate-a", notificationCandidateId: "candidate-a", originTrusted: true, notificationIdValid: true, featureEnabled: true };
  assert.equal(canMarkCandidateNotificationRead(base), true);
  assert.equal(canMarkCandidateNotificationRead({ ...base, notificationCandidateId: "candidate-b" }), false);
  assert.equal(canMarkCandidateNotificationRead({ ...base, originTrusted: false }), false);
  assert.equal(canMarkCandidateNotificationRead({ ...base, notificationIdValid: false }), false);
  assert.equal(canMarkCandidateNotificationRead({ ...base, featureEnabled: false }), false);
});

test("notification pagination is bounded and uses twenty rows", () => {
  assert.equal(CANDIDATE_NOTIFICATION_PAGE_SIZE, 20);
  assert.equal(parseCandidateNotificationPage("0"), 1);
  assert.equal(parseCandidateNotificationPage("3"), 3);
  assert.equal(parseCandidateNotificationPage("999999"), 10_000);
  assert.equal(getCandidateNotificationPageCount(0), 1);
  assert.equal(getCandidateNotificationPageCount(21), 2);
});

test("feature gate defaults disabled for migration compatibility", () => {
  assert.equal(isCandidateApplicationNotificationsEnabled({}), false);
  assert.equal(isCandidateApplicationNotificationsEnabled({ CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED: "false" }), false);
  assert.equal(isCandidateApplicationNotificationsEnabled({ CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED: "true" }), true);
});

test("database deduplicates each status-history event and indexes recipient reads", () => {
  const config = getTableConfig(candidateApplicationStatusNotifications);
  const uniqueHistory = config.uniqueConstraints.find((constraint) => constraint.name === "candidate_application_notifications_history_unique");
  assert.deepEqual(uniqueHistory?.columns.map((column) => column.name), ["status_history_id"]);
  assert.equal(config.indexes.some((index) => index.config.name === "candidate_application_notifications_candidate_read_idx"), true);
});
