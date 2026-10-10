"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidate } from "@/candidate-auth/session";
import { createCandidateApplication } from "./domain";

const jobIdSchema = z.uuid();

export async function applyToJob(formData: FormData) {
  const candidate = await requireCandidate();
  const parsedJobId = jobIdSchema.safeParse(formData.get("jobPostId"));
  if (!parsedJobId.success) redirect("/jobs");

  const result = await createCandidateApplication(candidate.id, parsedJobId.data);
  if (result === "resume-required") redirect("/candidate/resume?mode=edit&application=resume-required");
  if (result === "job-unavailable") redirect("/jobs?application=unavailable");
  if (result === "already-applied") redirect(`/jobs/${parsedJobId.data}?application=already`);

  revalidatePath("/candidate");
  revalidatePath("/candidate/applications");
  revalidatePath(`/jobs/${parsedJobId.data}`);
  redirect("/candidate/applications?applied=1");
}
