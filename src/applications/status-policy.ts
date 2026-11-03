export const APPLICATION_STATUSES = [
  "received",
  "reviewing",
  "interview",
  "rejected",
  "hired",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type ApplicationStatusFilter = "all" | ApplicationStatus;

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  received: "دریافت‌شده",
  reviewing: "در حال بررسی",
  interview: "مصاحبه",
  rejected: "رد شده",
  hired: "استخدام شده",
  withdrawn: "انصراف داده‌شده",
};

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  received: ["reviewing", "rejected"],
  reviewing: ["received", "interview", "rejected"],
  interview: ["reviewing", "hired", "rejected"],
  rejected: [],
  hired: [],
  withdrawn: [],
};

export const PRE_WITHDRAWAL_APPLICATION_STATUSES = APPLICATION_STATUSES.filter(
  (status) => status !== "withdrawn",
);

export function isCandidateApplicationWithdrawalEnabled(
  value = process.env.CANDIDATE_APPLICATION_WITHDRAWAL_ENABLED,
) {
  return value === "true";
}

export function getEnabledApplicationStatuses(
  withdrawalEnabled = isCandidateApplicationWithdrawalEnabled(),
): readonly ApplicationStatus[] {
  return withdrawalEnabled ? APPLICATION_STATUSES : PRE_WITHDRAWAL_APPLICATION_STATUSES;
}

export const DEFAULT_APPLICATION_STATUS: ApplicationStatus = "received";
export const APPLICATION_TRANSITION_BROWSER_FIELDS = ["jobId", "applicationId", "targetStatus"] as const;

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function parseApplicationStatusFilter(value: string | string[] | undefined): ApplicationStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "all" || (getEnabledApplicationStatuses() as readonly ApplicationStatus[]).includes(raw as ApplicationStatus)
    ? raw as ApplicationStatusFilter
    : "all";
}

export function getAllowedApplicationTransitions(status: ApplicationStatus) {
  return transitions[status];
}

export function canTransitionApplicationStatus(current: ApplicationStatus, target: ApplicationStatus) {
  return transitions[current].includes(target);
}

export function resolveApplicationTransition(current: ApplicationStatus, target: ApplicationStatus) {
  if (current === target) return "noop" as const;
  return canTransitionApplicationStatus(current, target) ? "update" as const : "invalid" as const;
}

export function matchesExpectedApplicationStatus(actual: ApplicationStatus, expected: ApplicationStatus) {
  return actual === expected;
}

export function isTerminalApplicationStatus(status: ApplicationStatus) {
  return transitions[status].length === 0;
}

export function canCompanyTransitionApplication(input: {
  authenticatedCompanyId: string | null;
  jobCompanyId: string;
  requestedJobId: string;
  applicationJobId: string;
}) {
  return input.authenticatedCompanyId !== null
    && input.authenticatedCompanyId === input.jobCompanyId
    && input.requestedJobId === input.applicationJobId;
}
