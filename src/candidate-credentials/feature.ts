export function isCandidateCredentialsEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.CANDIDATE_CREDENTIALS_ENABLED === "true";
}
