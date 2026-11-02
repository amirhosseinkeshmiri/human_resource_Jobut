export const CANDIDATE_DATA_REQUEST_TYPES = ["personal_data_export", "account_deletion"] as const;
export type CandidateDataRequestType = (typeof CANDIDATE_DATA_REQUEST_TYPES)[number];

export const CANDIDATE_DATA_REQUEST_STATUSES = [
  "pending", "in_progress", "completed", "rejected", "cancelled",
] as const;
export type CandidateDataRequestStatus = (typeof CANDIDATE_DATA_REQUEST_STATUSES)[number];

export const ACTIVE_CANDIDATE_DATA_REQUEST_STATUSES = ["pending", "in_progress"] as const;

export const candidateDataRequestTypeLabels: Record<CandidateDataRequestType, string> = {
  personal_data_export: "دریافت نسخه‌ای از داده‌های شخصی",
  account_deletion: "حذف حساب کاربری",
};

export const candidateDataRequestStatusLabels: Record<CandidateDataRequestStatus, string> = {
  pending: "در انتظار بررسی",
  in_progress: "در حال بررسی",
  completed: "انجام‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

export const CANDIDATE_VISIBLE_DATA_REQUEST_FIELDS = [
  "id", "requestType", "status", "createdAt", "updatedAt", "resolvedAt",
] as const;

export function isCandidateDataRequestType(value: unknown): value is CandidateDataRequestType {
  return typeof value === "string" && CANDIDATE_DATA_REQUEST_TYPES.includes(value as CandidateDataRequestType);
}

export function isCandidateDataRequestStatus(value: unknown): value is CandidateDataRequestStatus {
  return typeof value === "string" && CANDIDATE_DATA_REQUEST_STATUSES.includes(value as CandidateDataRequestStatus);
}

export function isActiveCandidateDataRequestStatus(status: CandidateDataRequestStatus) {
  return ACTIVE_CANDIDATE_DATA_REQUEST_STATUSES.includes(status as "pending" | "in_progress");
}

export function canCreateCandidateDataRequest(input: {
  authenticatedCandidateId: string | null;
  targetCandidateId: string | null;
  requestTypeValid: boolean;
  originTrusted: boolean;
  featureEnabled: boolean;
}) {
  return Boolean(
    input.featureEnabled
    && input.originTrusted
    && input.requestTypeValid
    && input.authenticatedCandidateId
    && input.targetCandidateId === input.authenticatedCandidateId,
  );
}
