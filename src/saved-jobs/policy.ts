export const SAVED_JOBS_PAGE_SIZE = 20;
export const SAVED_JOBS_BROWSER_FIELDS = ["jobPostId", "saved"] as const;

export function isCandidateSavedJobsEnabled(value = process.env.CANDIDATE_SAVED_JOBS_ENABLED) {
  return value === "true";
}

export function parseSavedJobsPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function getSavedJobsPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / SAVED_JOBS_PAGE_SIZE));
}

export function getSavedJobsOffset(page: number) {
  return (page - 1) * SAVED_JOBS_PAGE_SIZE;
}

export function canMutateSavedJob(input: {
  featureEnabled: boolean;
  authenticatedCandidate: boolean;
  originTrusted: boolean;
  formBounded: boolean;
  jobIdValid: boolean;
  desiredStateValid: boolean;
}) {
  return input.featureEnabled
    && input.authenticatedCandidate
    && input.originTrusted
    && input.formBounded
    && input.jobIdValid
    && input.desiredStateValid;
}

export function savedJobOwnershipKey(candidateAccountId: string, jobPostId: string) {
  return `${candidateAccountId}:${jobPostId}`;
}
