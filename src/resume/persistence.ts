import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateResumes,
  resumeEducations,
  resumeExperiences,
  resumeLanguages,
} from "@/db/schema";
import { candidateResumeLockKey } from "./locking";
import { buildResumePersistencePlan } from "./policy";
import type { CandidateResumeValues } from "./validation";

export async function saveCandidateResumeData(
  candidateAccountId: string,
  values: CandidateResumeValues,
) {
  const plan = buildResumePersistencePlan(candidateAccountId, values);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${candidateResumeLockKey(candidateAccountId)}, 0))`,
    );

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

    if (plan.experiences.length) {
      await tx.insert(resumeExperiences).values(
        plan.experiences.map((row) => ({ resumeId: resume.id, ...row })),
      );
    }
    if (plan.educations.length) {
      await tx.insert(resumeEducations).values(
        plan.educations.map((row) => ({ resumeId: resume.id, ...row })),
      );
    }
    if (plan.languages.length) {
      await tx.insert(resumeLanguages).values(
        plan.languages.map((row) => ({ resumeId: resume.id, ...row })),
      );
    }

    return resume.id;
  });
}
