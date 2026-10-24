"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCandidate } from "@/candidate-auth/session";
import { saveCandidateResumeData } from "./persistence";
import { candidateResumeSchema } from "./validation";

export async function saveCandidateResume(formData: FormData) {
  const candidate = await requireCandidate();
  const payload = formData.get("resumePayload");
  let submitted: unknown;
  try {
    submitted = typeof payload === "string" ? JSON.parse(payload) : null;
  } catch {
    redirect("/candidate/resume?mode=edit&error=invalid");
  }

  const parsed = candidateResumeSchema.safeParse(submitted);
  if (!parsed.success) redirect("/candidate/resume?mode=edit&error=invalid");
  await saveCandidateResumeData(candidate.id, parsed.data);

  revalidatePath("/candidate");
  revalidatePath("/candidate/resume");
  redirect("/candidate/resume?saved=1");
}
