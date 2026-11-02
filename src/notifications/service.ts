import "server-only";
import { isCandidateApplicationNotificationsEnabled } from "./feature";
import { runBestEffortNotificationDelivery } from "./application-status-policy";
import {
  materializeApplicationStatusNotificationsForApplication,
  materializeCandidateApplicationStatusNotifications,
} from "./repository";

export async function deliverApplicationStatusNotifications(applicationId: string) {
  if (!isCandidateApplicationNotificationsEnabled()) return "disabled" as const;
  const result = await runBestEffortNotificationDelivery(
    () => materializeApplicationStatusNotificationsForApplication(applicationId),
  );
  if (result === "failed") {
    console.error(JSON.stringify({ event: "candidate_notification_delivery_failure", code: "persistence_failed" }));
  }
  return result;
}

export async function reconcileCandidateApplicationStatusNotifications(candidateAccountId: string) {
  if (!isCandidateApplicationNotificationsEnabled()) return "disabled" as const;
  try {
    await materializeCandidateApplicationStatusNotifications(candidateAccountId);
    return "reconciled" as const;
  } catch {
    console.error(JSON.stringify({ event: "candidate_notification_reconciliation_failure", code: "persistence_failed" }));
    return "failed" as const;
  }
}
