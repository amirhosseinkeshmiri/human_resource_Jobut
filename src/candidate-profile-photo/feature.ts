export function isCandidateProfilePhotoEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.CANDIDATE_PROFILE_PHOTO_ENABLED === "true";
}
