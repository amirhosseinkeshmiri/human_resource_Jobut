export const ACTIVE_JOB_STATUS = "published" as const;
export const JOB_PUBLISH_CREDIT_COST = 1;

export type JobStatus = "draft" | "published" | "closed";

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  closed: "بسته‌شده",
};

export function createDraftJobValues(companyId: string, values: JobPostFormValues) {
  return { companyId, ...values, status: "draft" as const };
}

export function isJobOwnedByCompany(jobCompanyId: string, companyId: string) {
  return jobCompanyId === companyId;
}

export function canEditJob(status: JobStatus) {
  return status === "draft";
}

export type PublishEligibility = "publishable" | "not-found" | "not-draft";

export function getPublishEligibility(
  job: { companyId: string; status: JobStatus } | null,
  authenticatedCompanyId: string,
): PublishEligibility {
  if (!job || job.companyId !== authenticatedCompanyId) return "not-found";
  return job.status === "draft" ? "publishable" : "not-draft";
}

export function getPublishCreditDecision(balance: number) {
  return balance >= JOB_PUBLISH_CREDIT_COST
    ? { allowed: true, debitAmount: -JOB_PUBLISH_CREDIT_COST } as const
    : { allowed: false, debitAmount: 0 } as const;
}

export function getPublicationTimestamps(publishedAt = new Date()) {
  return {
    publishedAt,
    expiresAt: new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
  };
}
import type { JobPostFormValues } from "./validation";
