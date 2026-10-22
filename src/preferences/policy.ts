import type { CandidateJobPreferences } from "./validation";

export const CANDIDATE_PREFERENCE_BROWSER_FIELDS = [
  "preferredLocations",
  "preferredWorkplaceTypes",
  "preferredEmploymentTypes",
  "preferredSeniorityLevels",
] as const;

export function buildCandidatePreferencePersistence(
  authenticatedCandidateId: string,
  preferences: CandidateJobPreferences,
) {
  return { candidateAccountId: authenticatedCandidateId, ...preferences };
}
