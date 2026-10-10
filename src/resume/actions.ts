"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCandidate } from "@/candidate-auth/session";
import { db } from "@/db";
import { candidateResumes, resumeEducations, resumeExperiences, resumeLanguages } from "@/db/schema";
import { buildResumePersistencePlan } from "./policy";
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
  const plan = buildResumePersistencePlan(candidate.id, parsed.data);

  await db.transaction(async (tx) => {
    const [resume] = await tx.insert(candidateResumes).values(plan.resume)
      .onConflictDoUpdate({
        target: candidateResumes.candidateAccountId,
        set: {
          firstName: plan.resume.firstName,
          lastName: plan.resume.lastName,
          city: plan.resume.city,
          professionalTitle: plan.resume.professionalTitle,
          professionalSummary: plan.resume.professionalSummary,
          skills: plan.resume.skills,
          linkedinUrl: plan.resume.linkedinUrl,
          portfolioUrl: plan.resume.portfolioUrl,
          updatedAt: new Date(),
        },
      })
      .returning({ id: candidateResumes.id });

    await tx.delete(resumeExperiences).where(eq(resumeExperiences.resumeId, resume.id));
    await tx.delete(resumeEducations).where(eq(resumeEducations.resumeId, resume.id));
    await tx.delete(resumeLanguages).where(eq(resumeLanguages.resumeId, resume.id));

    if (plan.experiences.length) await tx.insert(resumeExperiences).values(plan.experiences.map((row) => ({ resumeId: resume.id, ...row })));
    if (plan.educations.length) await tx.insert(resumeEducations).values(plan.educations.map((row) => ({ resumeId: resume.id, ...row })));
    if (plan.languages.length) await tx.insert(resumeLanguages).values(plan.languages.map((row) => ({ resumeId: resume.id, ...row })));
  });

  revalidatePath("/candidate");
  revalidatePath("/candidate/resume");
  redirect("/candidate/resume?saved=1");
}
