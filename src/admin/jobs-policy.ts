import type { JobStatus } from "@/jobs/policy";

export const ADMIN_JOBS_PAGE_SIZE = 20;

export const adminJobFilters = [
  "all",
  "draft",
  "published_active",
  "published_expired",
  "closed",
] as const;

export const adminJobSorts = [
  "created_desc",
  "created_asc",
  "published_desc",
  "published_asc",
  "expires_asc",
  "expires_desc",
] as const;

export type AdminJobFilter = (typeof adminJobFilters)[number];
export type AdminJobSort = (typeof adminJobSorts)[number];
export type AdminJobPresentationStatus = "draft" | "published_active" | "published_expired" | "published_incomplete" | "closed";

export const adminJobPresentationLabels: Record<AdminJobPresentationStatus, string> = {
  draft: "پیش‌نویس",
  published_active: "فعال",
  published_expired: "منقضی‌شده",
  published_incomplete: "اطلاعات انتشار ناقص",
  closed: "بسته‌شده",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminJobParams(input: {
  q?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  page?: string | string[];
}) {
  const requestedFilter = firstValue(input.status);
  const status = adminJobFilters.includes(requestedFilter as AdminJobFilter)
    ? requestedFilter as AdminJobFilter
    : "all";
  const requestedSort = firstValue(input.sort);
  const sort = adminJobSorts.includes(requestedSort as AdminJobSort)
    ? requestedSort as AdminJobSort
    : "created_desc";
  const parsedPage = Number.parseInt(firstValue(input.page) ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const query = (firstValue(input.q) ?? "").trim().slice(0, 200);
  return { query, status, sort, page };
}

export function getAdminJobPresentationStatus(job: {
  status: JobStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
}, now = new Date()): AdminJobPresentationStatus {
  if (job.status === "draft" || job.status === "closed") return job.status;
  if (!job.publishedAt || !job.expiresAt) return "published_incomplete";
  return job.expiresAt.getTime() <= now.getTime() ? "published_expired" : "published_active";
}

export function matchesAdminJobSearch(job: { title: string; companyName: string }, query: string) {
  const normalized = query.trim().toLocaleLowerCase("fa-IR");
  return !normalized
    || job.title.toLocaleLowerCase("fa-IR").includes(normalized)
    || job.companyName.toLocaleLowerCase("fa-IR").includes(normalized);
}

export function getAdminJobPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / ADMIN_JOBS_PAGE_SIZE));
}

export function isJobId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
