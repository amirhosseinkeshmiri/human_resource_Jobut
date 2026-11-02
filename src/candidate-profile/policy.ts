import type { CandidateBasicProfileValues } from "@/resume/validation";

export const CANDIDATE_BASIC_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "city",
  "professionalTitle",
  "professionalSummary",
  "linkedinUrl",
  "portfolioUrl",
] as const;

export function canUpdateCandidateProfile(authenticatedCandidateId: string, targetCandidateId: string) {
  return authenticatedCandidateId === targetCandidateId;
}

export function buildCandidateBasicProfileUpdate(values: CandidateBasicProfileValues) {
  return Object.fromEntries(
    CANDIDATE_BASIC_PROFILE_FIELDS.map((field) => [field, values[field]]),
  ) as CandidateBasicProfileValues;
}
