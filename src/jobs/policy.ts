export const JOB_TITLE_MAX_LENGTH = 200;
export const ACTIVE_JOB_STATUS = "published" as const;
export const JOB_PUBLISH_CREDIT_COST = 1;

export type JobStatus = "draft" | "published" | "closed";

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  closed: "بسته‌شده",
};

export function validateJobTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) return { ok: false, error: "عنوان آگهی را وارد کنید." } as const;
  if (title.length > JOB_TITLE_MAX_LENGTH) {
    return { ok: false, error: `عنوان آگهی نباید بیشتر از ${JOB_TITLE_MAX_LENGTH.toLocaleString("fa-IR")} نویسه باشد.` } as const;
  }
  return { ok: true, title } as const;
}

export function createDraftJobValues(companyId: string, title: string) {
  return { companyId, title, status: "draft" as const };
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
