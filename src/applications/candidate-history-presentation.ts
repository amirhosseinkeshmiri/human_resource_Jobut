import { orderStatusHistoryOldestFirst } from "./status-history-policy";
import { applicationStatusLabels, type ApplicationStatus } from "./status-policy";

export type CandidateStatusHistoryItem = {
  id: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedAt: Date;
};

export function getCandidateVisibleStatusLabel(
  status: ApplicationStatus,
  withdrawalEnabled: boolean,
) {
  return status === "withdrawn" && !withdrawalEnabled
    ? "وضعیت نهایی"
    : applicationStatusLabels[status];
}

export function presentCandidateStatusHistory(
  rows: CandidateStatusHistoryItem[],
  withdrawalEnabled: boolean,
) {
  return orderStatusHistoryOldestFirst(rows).map((row) => ({
    ...row,
    fromLabel: getCandidateVisibleStatusLabel(row.fromStatus, withdrawalEnabled),
    toLabel: getCandidateVisibleStatusLabel(row.toStatus, withdrawalEnabled),
    changedBy: row.toStatus === "withdrawn" && withdrawalEnabled
      ? "candidate" as const
      : "employer" as const,
    actorLabel: row.toStatus === "withdrawn" && withdrawalEnabled
      ? "انصراف توسط شما"
      : "به‌روزرسانی توسط کارفرما",
  }));
}

export function getCandidateApplicationPublicIdentity(input: {
  jobTitle: string | null | undefined;
  companyName: string | null | undefined;
}) {
  return {
    jobTitle: input.jobTitle?.trim() || "فرصت شغلی دیگر در دسترس نیست",
    companyName: input.companyName?.trim() || "نام شرکت در دسترس نیست",
  };
}
