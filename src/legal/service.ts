import "server-only";
import { redirect } from "next/navigation";
import { CURRENT_LEGAL_DOCUMENTS } from "./documents";
import { isCandidateLegalAcceptanceEnforced } from "./feature";
import { findCurrentCandidateLegalAcceptance } from "./repository";
import { hasAcceptedDocumentVersions } from "./policy";

export async function candidateHasCurrentLegalAcceptance(candidateAccountId: string) {
  if (!isCandidateLegalAcceptanceEnforced()) return true;
  const acceptance = await findCurrentCandidateLegalAcceptance(candidateAccountId, CURRENT_LEGAL_DOCUMENTS);
  return hasAcceptedDocumentVersions(acceptance, candidateAccountId, CURRENT_LEGAL_DOCUMENTS);
}

export async function requireCandidateLegalAcceptance(candidateAccountId: string) {
  if (!(await candidateHasCurrentLegalAcceptance(candidateAccountId))) {
    redirect("/candidate/legal/acceptance?required=application");
  }
}
