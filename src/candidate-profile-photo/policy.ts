export function canAccessCandidateProfilePhoto(
  authenticatedCandidateId: string | null,
  ownerCandidateId: string,
) {
  return authenticatedCandidateId !== null && authenticatedCandidateId === ownerCandidateId;
}
