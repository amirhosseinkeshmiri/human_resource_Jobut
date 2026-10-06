import type { JobStatus } from "./policy";

export interface PublicJobVisibilityInput {
  status: JobStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
}

export function isPublicJobActive(job: PublicJobVisibilityInput, now = new Date()) {
  return job.status === "published"
    && job.publishedAt !== null
    && job.expiresAt !== null
    && job.expiresAt.getTime() > now.getTime();
}

export function formatJobSalary(job: {
  salaryNegotiable: boolean | null;
  salaryMin: number | null;
  salaryMax: number | null;
}) {
  if (job.salaryNegotiable) return "حقوق توافقی";
  if (job.salaryMin === null || job.salaryMax === null) return "—";

  const formatter = new Intl.NumberFormat("fa-IR");
  return `${formatter.format(job.salaryMin)} تا ${formatter.format(job.salaryMax)} تومان`;
}

export const PUBLIC_JOB_DETAIL_FIELDS = [
  "id",
  "title",
  "workplaceType",
  "employmentType",
  "location",
  "seniorityLevel",
  "salaryMin",
  "salaryMax",
  "salaryNegotiable",
  "requiredSkills",
  "description",
  "publishedAt",
  "expiresAt",
  "companyName",
  "companyLogoUrl",
  "industryName",
] as const;
