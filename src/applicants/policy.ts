export const EMPLOYER_APPLICANTS_PAGE_SIZE = 20;

export const APPLICANT_LIST_FIELDS = [
  "applicationId",
  "firstName",
  "lastName",
  "professionalTitle",
  "city",
  "skills",
  "status",
  "createdAt",
] as const;

export const EMPLOYER_RESUME_FIELDS = [
  "firstName",
  "lastName",
  "city",
  "professionalTitle",
  "professionalSummary",
  "skills",
  "linkedinUrl",
  "portfolioUrl",
  "experiences",
  "educations",
  "languages",
] as const;

export const EMPLOYER_APPLICANT_CAPABILITIES = ["list", "view", "transition-status"] as const;

export function parseApplicantPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function getApplicantPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / EMPLOYER_APPLICANTS_PAGE_SIZE));
}

export function canCompanyReviewJob(authenticatedCompanyId: string, jobCompanyId: string) {
  return authenticatedCompanyId === jobCompanyId;
}

export function canCompanyReviewApplication(input: {
  authenticatedCompanyId: string;
  jobCompanyId: string;
  requestedJobId: string;
  applicationJobId: string;
}) {
  return input.authenticatedCompanyId === input.jobCompanyId
    && input.requestedJobId === input.applicationJobId;
}

export function canReviewHistoricalJob(status: "draft" | "published" | "closed") {
  return status === "draft" || status === "published" || status === "closed";
}

export function isRouteId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function countCompanyApplications(
  applications: Array<{ jobCompanyId: string }>,
  authenticatedCompanyId: string,
) {
  return applications.filter((application) => application.jobCompanyId === authenticatedCompanyId).length;
}
