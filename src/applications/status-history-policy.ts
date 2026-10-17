import type { ApplicationStatus } from "./status-policy";
import { resolveApplicationTransition } from "./status-policy";

export const APPLICATION_STATUS_HISTORY_LIMIT = 100;
export const APPLICATION_SUBMISSION_TIMELINE_LABEL = "درخواست ارسال شد";
export const APPLICATION_STATUS_HISTORY_FIELDS = [
  "id",
  "jobApplicationId",
  "fromStatus",
  "toStatus",
  "changedAt",
] as const;
export const STATUS_TRANSITION_TRANSACTION_STEPS = [
  "verify-current-status",
  "conditional-status-update",
  "append-history",
] as const;

export function planApplicationStatusTransition(
  currentStatus: ApplicationStatus,
  targetStatus: ApplicationStatus,
) {
  const decision = resolveApplicationTransition(currentStatus, targetStatus);
  if (decision !== "update") return { decision } as const;
  return {
    decision,
    history: { fromStatus: currentStatus, toStatus: targetStatus },
  } as const;
}

export function buildApplicationStatusHistoryInsert(
  jobApplicationId: string,
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus,
) {
  return { jobApplicationId, fromStatus, toStatus };
}

export function shouldAppendApplicationStatusHistory(
  decision: "update" | "noop" | "invalid",
  conditionalUpdateSucceeded: boolean,
) {
  return decision === "update" && conditionalUpdateSucceeded;
}

export function orderStatusHistoryOldestFirst<T extends { changedAt: Date; id: string }>(rows: T[]) {
  return [...rows].sort((first, second) => (
    first.changedAt.getTime() - second.changedAt.getTime()
    || first.id.localeCompare(second.id)
  ));
}
