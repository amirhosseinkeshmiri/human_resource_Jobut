import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateCredentials, candidateResumes, resumeEducations, resumeExperiences, resumeLanguages } from "@/db/schema";
import { isCandidateCredentialsEnabled } from "@/candidate-credentials/feature";

export async function getCandidateResume(candidateAccountId: string) {
  const [resume] = await db.select().from(candidateResumes)
    .where(eq(candidateResumes.candidateAccountId, candidateAccountId)).limit(1);
  if (!resume) return null;

  const [experiences, educations, languages, credentials] = await Promise.all([
    db.select().from(resumeExperiences).where(eq(resumeExperiences.resumeId, resume.id)).orderBy(asc(resumeExperiences.sortOrder)),
    db.select().from(resumeEducations).where(eq(resumeEducations.resumeId, resume.id)).orderBy(asc(resumeEducations.sortOrder)),
    db.select().from(resumeLanguages).where(eq(resumeLanguages.resumeId, resume.id)).orderBy(asc(resumeLanguages.sortOrder)),
    isCandidateCredentialsEnabled()
      ? db.select().from(candidateCredentials)
        .where(eq(candidateCredentials.candidateAccountId, candidateAccountId))
        .orderBy(asc(candidateCredentials.issueDate), asc(candidateCredentials.createdAt))
      : Promise.resolve([]),
  ]);

  return { ...resume, experiences, educations, languages, credentials };
}

export async function candidateHasResume(candidateAccountId: string) {
  const [resume] = await db.select({ id: candidateResumes.id }).from(candidateResumes)
    .where(eq(candidateResumes.candidateAccountId, candidateAccountId)).limit(1);
  return Boolean(resume);
}
