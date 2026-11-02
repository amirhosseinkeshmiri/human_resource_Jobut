"use server";

import { redirect } from "next/navigation";
import { requireCandidate } from "@/candidate-auth/session";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { CURRENT_LEGAL_DOCUMENTS, LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE } from "./documents";
import { isCandidateLegalAcceptanceFeatureEnabled } from "./feature";
import { canRecordCandidateLegalAcceptance } from "./policy";
import { recordCandidateLegalAcceptance } from "./repository";

export async function acceptCurrentCandidateLegalDocuments(formData: FormData) {
  const candidate = await requireCandidate();
  const inspection = await inspectTrustedAuthActionRequest();
  const allowed = canRecordCandidateLegalAcceptance({
    authenticatedCandidateId: candidate.id,
    targetCandidateId: candidate.id,
    termsAffirmed: formData.get("termsAccepted") === "yes",
    privacyAffirmed: formData.get("privacyAccepted") === "yes",
    originTrusted: inspection.trusted,
    featureEnabled: isCandidateLegalAcceptanceFeatureEnabled(),
    documentsApproved: LEGAL_DOCUMENTS_APPROVED_FOR_ACCEPTANCE,
  });
  if (!allowed) redirect("/candidate/legal/acceptance?error=required");
  await recordCandidateLegalAcceptance(candidate.id, CURRENT_LEGAL_DOCUMENTS);
  redirect("/jobs?legal=accepted");
}
