export const JOB_TITLE_MAX_LENGTH = 200;
export const ACTIVE_JOB_STATUS = "published" as const;

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
