export interface LegalDocumentVersions {
  termsVersion: string;
  privacyVersion: string;
}

export interface LegalAcceptanceRecord extends LegalDocumentVersions {
  candidateAccountId: string;
}

export function hasAcceptedDocumentVersions(
  acceptance: LegalAcceptanceRecord | null,
  candidateAccountId: string,
  current: LegalDocumentVersions,
) {
  return acceptance?.candidateAccountId === candidateAccountId
    && acceptance.termsVersion === current.termsVersion
    && acceptance.privacyVersion === current.privacyVersion;
}

export function canRecordCandidateLegalAcceptance(input: {
  authenticatedCandidateId: string | null;
  targetCandidateId: string | null;
  termsAffirmed: boolean;
  privacyAffirmed: boolean;
  originTrusted: boolean;
  featureEnabled: boolean;
  documentsApproved: boolean;
}) {
  return Boolean(
    input.authenticatedCandidateId
    && input.targetCandidateId === input.authenticatedCandidateId
    && input.termsAffirmed
    && input.privacyAffirmed
    && input.originTrusted
    && input.featureEnabled
    && input.documentsApproved,
  );
}
