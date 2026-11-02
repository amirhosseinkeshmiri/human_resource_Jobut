"use server";

import { redirect } from "next/navigation";
import { requireCandidate } from "@/candidate-auth/session";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { isCandidateDataRequestsEnabled } from "./feature";
import { canCreateCandidateDataRequest, isCandidateDataRequestType } from "./policy";
import { createCandidateDataRequest } from "./repository";

export async function submitCandidateDataRequest(formData: FormData) {
  const candidate = await requireCandidate();
  const requestType = formData.get("requestType");
  const inspection = await inspectTrustedAuthActionRequest();
  const allowed = canCreateCandidateDataRequest({
    authenticatedCandidateId: candidate.id,
    targetCandidateId: candidate.id,
    requestTypeValid: isCandidateDataRequestType(requestType),
    originTrusted: inspection.trusted && isBoundedAuthFormData(formData, ["requestType"]),
    featureEnabled: isCandidateDataRequestsEnabled(),
  });
  if (!allowed || !isCandidateDataRequestType(requestType)) {
    redirect("/candidate/privacy?result=unavailable");
  }
  let result: "created" | "already-active";
  try {
    result = await createCandidateDataRequest(candidate.id, requestType);
  } catch {
    console.error(JSON.stringify({ event: "candidate_data_request_failure", code: "transaction_failed" }));
    redirect("/candidate/privacy?result=error");
  }
  redirect(`/candidate/privacy?result=${result}`);
}
