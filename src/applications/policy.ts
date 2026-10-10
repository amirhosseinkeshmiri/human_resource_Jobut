import { isPublicJobActive, type PublicJobVisibilityInput } from "@/jobs/public-policy";

export type ApplicationEligibility = "login-required" | "resume-required" | "job-unavailable" | "already-applied" | "eligible";

export const JOB_APPLICATION_FIELDS = ["id", "candidateAccountId", "candidateResumeId", "jobPostId", "createdAt"] as const;
export const APPLICATION_BROWSER_FIELDS = ["jobPostId"] as const;

export function getApplicationEligibility(input: {
  authenticated: boolean;
  resumeComplete: boolean;
  job: PublicJobVisibilityInput;
  alreadyApplied: boolean;
}, now = new Date()): ApplicationEligibility {
  if (!input.authenticated) return "login-required";
  if (!input.resumeComplete) return "resume-required";
  if (!isPublicJobActive(input.job, now)) return "job-unavailable";
  if (input.alreadyApplied) return "already-applied";
  return "eligible";
}

export function isApplicationOwnedByCandidate(applicationCandidateId: string, authenticatedCandidateId: string) {
  return applicationCandidateId === authenticatedCandidateId;
}

export function applicationUniquenessKey(candidateAccountId: string, jobPostId: string) {
  return `${candidateAccountId}:${jobPostId}`;
}

export function buildApplicationInsert(candidateAccountId: string, candidateResumeId: string, jobPostId: string) {
  return { candidateAccountId, candidateResumeId, jobPostId };
}

export function shouldKeepApplicationInHistory() {
  return true;
}
