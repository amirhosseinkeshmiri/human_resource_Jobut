import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICATION_MESSAGES_PER_DAY,
  APPLICATION_MESSAGES_PER_MINUTE,
  APPLICATION_THREAD_MESSAGE_LIMIT,
  canSendApplicationMessage,
  normalizeApplicationMessage,
} from "./policy";

test("message content is plain normalized bounded text", () => {
  assert.equal(normalizeApplicationMessage("  سلام\r\nبرای مصاحبه  "), "سلام\nبرای مصاحبه");
  assert.equal(normalizeApplicationMessage(" "), null);
  assert.equal(normalizeApplicationMessage("a".repeat(2_001)), null);
  assert.equal(normalizeApplicationMessage("ok\u0000"), null);
});

test("only active recruitment applications can receive new messages", () => {
  const base = { applicationStatus: "reviewing" as const, jobStatus: "published" as const, senderRole: "employer" as const, kind: "recruitment_message" as const, hasEmployerMessage: false };
  assert.equal(canSendApplicationMessage(base), true);
  assert.equal(canSendApplicationMessage({ ...base, applicationStatus: "rejected" }), false);
  assert.equal(canSendApplicationMessage({ ...base, applicationStatus: "hired" }), false);
  assert.equal(canSendApplicationMessage({ ...base, jobStatus: "closed" }), false);
});

test("candidate replies require an employer-originated thread and cannot forge invitations", () => {
  const base = { applicationStatus: "received" as const, jobStatus: "published" as const, senderRole: "candidate" as const, kind: "recruitment_message" as const, hasEmployerMessage: false };
  assert.equal(canSendApplicationMessage(base), false);
  assert.equal(canSendApplicationMessage({ ...base, hasEmployerMessage: true }), true);
  assert.equal(canSendApplicationMessage({ ...base, hasEmployerMessage: true, kind: "interview_invitation" }), false);
});

test("anti-abuse quotas are finite and intentionally restrained", () => {
  assert.deepEqual([APPLICATION_MESSAGES_PER_MINUTE, APPLICATION_MESSAGES_PER_DAY, APPLICATION_THREAD_MESSAGE_LIMIT], [5, 50, 500]);
});
