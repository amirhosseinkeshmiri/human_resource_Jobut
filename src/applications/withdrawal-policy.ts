import type { ApplicationStatus } from "./status-policy";

export const WITHDRAWABLE_APPLICATION_STATUSES = ["received", "reviewing", "interview"] as const;
export const APPLICATION_WITHDRAWAL_BROWSER_FIELDS = ["applicationId", "confirmed"] as const;
export const WITHDRAWAL_PRESERVED_RECORDS = ["job-application", "resume-snapshot", "status-history", "candidate-job-uniqueness"] as const;
export const CANDIDATE_WITHDRAWAL_NOTIFICATION_POLICY = "none" as const;

export function canWithdrawApplication(status: ApplicationStatus) {
  return WITHDRAWABLE_APPLICATION_STATUSES.includes(status as (typeof WITHDRAWABLE_APPLICATION_STATUSES)[number]);
}

export function resolveCandidateWithdrawal(status: ApplicationStatus) {
  if (status === "withdrawn") return "already-withdrawn" as const;
  return canWithdrawApplication(status) ? "withdraw" as const : "not-allowed" as const;
}

export function canCandidateWithdrawOwnedApplication(
  authenticatedCandidateId: string | null,
  applicationCandidateId: string,
  status: ApplicationStatus,
) {
  return authenticatedCandidateId !== null
    && authenticatedCandidateId === applicationCandidateId
    && canWithdrawApplication(status);
}

export function canSubmitApplicationWithdrawal(input: {
  featureEnabled: boolean;
  authenticatedCandidate: boolean;
  originTrusted: boolean;
  formBounded: boolean;
  applicationIdValid: boolean;
  explicitlyConfirmed: boolean;
}) {
  return Object.values(input).every(Boolean);
}

export const WITHDRAWAL_TRANSACTION_STEPS = [
  "lock-owned-application",
  "validate-current-status",
  "conditional-status-update",
  "append-status-history",
] as const;
