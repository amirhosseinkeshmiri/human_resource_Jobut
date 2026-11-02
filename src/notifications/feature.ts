import "server-only";

export function isCandidateApplicationNotificationsEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.CANDIDATE_APPLICATION_NOTIFICATIONS_ENABLED === "true";
}
