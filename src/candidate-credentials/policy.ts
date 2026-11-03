import { z } from "zod";

export const credentialIdSchema = z.uuid();
export const CREDENTIAL_JSON_BODY_LIMIT = 8 * 1024;
export const CREDENTIAL_DOCUMENT_VISIBILITY = "candidate-private" as const;
export const CREDENTIAL_SNAPSHOT_EXCLUDES_DOCUMENTS = true;

export function canAccessCandidateCredential(authenticatedCandidateId: string | null, ownerCandidateId: string) {
  return authenticatedCandidateId !== null && authenticatedCandidateId === ownerCandidateId;
}

export function isBoundedCredentialJson(raw: string) {
  return new TextEncoder().encode(raw).byteLength <= CREDENTIAL_JSON_BODY_LIMIT;
}
