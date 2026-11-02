"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidate } from "@/candidate-auth/session";
import { inspectTrustedAuthActionRequest } from "@/auth/request-security";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { requireCandidateLegalAcceptance } from "@/legal/service";
import { createCandidateApplication } from "./domain";
import { canSubmitApplicationRequest } from "./policy";

const jobIdSchema = z.uuid();

export async function applyToJob(formData: FormData) {
  const candidate = await requireCandidate();
  const parsedJobId = jobIdSchema.safeParse(formData.get("jobPostId"));
  const requestInspection = await inspectTrustedAuthActionRequest();
  if (!canSubmitApplicationRequest({
    originTrusted: requestInspection.trusted,
    formBounded: isBoundedAuthFormData(formData, ["jobPostId"]),
    jobIdValid: parsedJobId.success,
  })) redirect("/jobs?application=invalid");
  if (!parsedJobId.success) redirect("/jobs?application=invalid");

  await requireCandidateLegalAcceptance(candidate.id);

  let result;
  try {
    result = await createCandidateApplication(candidate.id, parsedJobId.data);
  } catch {
    console.error(JSON.stringify({ event: "candidate_application_failure", code: "transaction_failed" }));
    redirect(`/jobs/${parsedJobId.data}?application=error`);
  }
  if (result === "resume-required") redirect("/candidate/resume?mode=edit&application=resume-required");
  if (result === "job-unavailable") redirect("/jobs?application=unavailable");
  if (result === "already-applied") redirect(`/jobs/${parsedJobId.data}?application=already`);

  revalidatePath("/candidate");
  revalidatePath("/candidate/applications");
  revalidatePath(`/jobs/${parsedJobId.data}`);
  redirect("/candidate/applications?applied=1");
}
