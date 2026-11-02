import type { ApplicationStatus } from "@/applications/status-policy";

export const CANDIDATE_NOTIFICATION_PAGE_SIZE = 20;
export const CANDIDATE_NOTIFICATION_PAGE_MAX = 10_000;
export const CANDIDATE_APPLICATION_NOTIFICATION_FIELDS = [
  "id", "applicationId", "jobTitle", "companyName", "toStatus", "occurredAt", "readAt",
] as const;
export const STATUS_NOTIFICATION_DELIVERY_STEPS = [
  "commit-status-and-history",
  "best-effort-materialize-notification",
] as const;

export function parseCandidateNotificationPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, CANDIDATE_NOTIFICATION_PAGE_MAX)
    : 1;
}

export function getCandidateNotificationPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / CANDIDATE_NOTIFICATION_PAGE_SIZE));
}

export function canCandidateReadNotification(
  authenticatedCandidateId: string | null,
  notificationCandidateId: string,
) {
  return authenticatedCandidateId !== null && authenticatedCandidateId === notificationCandidateId;
}

export function canMarkCandidateNotificationRead(input: {
  authenticatedCandidateId: string | null;
  notificationCandidateId: string;
  originTrusted: boolean;
  notificationIdValid: boolean;
  featureEnabled: boolean;
}) {
  return input.featureEnabled
    && input.originTrusted
    && input.notificationIdValid
    && canCandidateReadNotification(input.authenticatedCandidateId, input.notificationCandidateId);
}

export function buildApplicationStatusNotificationSummary(status: ApplicationStatus) {
  return { status };
}

export function shouldDeliverApplicationStatusNotification(
  transitionResult: "updated" | "noop" | "not-found" | "invalid-transition" | "stale",
) {
  return transitionResult === "updated";
}

export async function runBestEffortNotificationDelivery(deliver: () => Promise<void>) {
  try {
    await deliver();
    return "delivered" as const;
  } catch {
    return "failed" as const;
  }
}
