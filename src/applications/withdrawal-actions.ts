"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { requireCandidate } from "@/candidate-auth/session";
import { isCandidateApplicationWithdrawalEnabled } from "./status-policy";
import { withdrawCandidateApplication } from "./withdrawal";
import { APPLICATION_WITHDRAWAL_BROWSER_FIELDS, canSubmitApplicationWithdrawal } from "./withdrawal-policy";

const applicationIdSchema = z.uuid();

export async function withdrawApplication(formData: FormData): Promise<void> {
  const candidate = await requireCandidate();
  const applicationId = applicationIdSchema.safeParse(formData.get("applicationId"));
  const requestInspection = await inspectTrustedAuthActionRequest();
  const featureEnabled = isCandidateApplicationWithdrawalEnabled();
  if (!canSubmitApplicationWithdrawal({
    featureEnabled,
    authenticatedCandidate: true,
    originTrusted: requestInspection.trusted,
    formBounded: isBoundedAuthFormData(formData, [...APPLICATION_WITHDRAWAL_BROWSER_FIELDS]),
    applicationIdValid: applicationId.success,
    explicitlyConfirmed: formData.get("confirmed") === "true",
  }) || !applicationId.success) notFound();

  const detailPath = `/candidate/applications/${applicationId.data}`;
  let result: Awaited<ReturnType<typeof withdrawCandidateApplication>>;
  try {
    result = await withdrawCandidateApplication(candidate.id, applicationId.data);
  } catch {
    console.error(JSON.stringify({ event: "candidate_application_withdrawal_failure", code: "transaction_failed" }));
    redirect(`${detailPath}?withdrawal=error`);
  }
  if (result === "not-found") notFound();
  if (result === "not-allowed" || result === "stale") redirect(`${detailPath}?withdrawal=${result}`);
  revalidatePath("/candidate");
  revalidatePath("/candidate/applications");
  revalidatePath(detailPath);
  revalidatePath("/employer");
  redirect(`${detailPath}?withdrawal=${result === "withdrawn" ? "success" : "already"}`);
}
