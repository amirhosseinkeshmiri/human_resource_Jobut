import "server-only";

export function isCandidateDataRequestsEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.CANDIDATE_DATA_REQUESTS_ENABLED === "true";
}
