import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateResumes,
  jobApplications,
  jobPosts,
  resumeEducations,
  resumeExperiences,
  resumeLanguages,
} from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { isStoredResumeComplete } from "@/resume/policy";
import { buildApplicationInsert } from "./policy";

export type CreateApplicationResult = "created" | "already-applied" | "resume-required" | "job-unavailable";

export async function createCandidateApplication(
  candidateAccountId: string,
  jobPostId: string,
  now = new Date(),
): Promise<CreateApplicationResult> {
  return db.transaction(async (tx) => {
    const [resume] = await tx.select().from(candidateResumes)
      .where(eq(candidateResumes.candidateAccountId, candidateAccountId)).limit(1);
    if (!resume) return "resume-required";

    const experiences = await tx.select().from(resumeExperiences)
      .where(eq(resumeExperiences.resumeId, resume.id)).orderBy(asc(resumeExperiences.sortOrder));
    const educations = await tx.select().from(resumeEducations)
      .where(eq(resumeEducations.resumeId, resume.id)).orderBy(asc(resumeEducations.sortOrder));
    const languages = await tx.select().from(resumeLanguages)
      .where(eq(resumeLanguages.resumeId, resume.id)).orderBy(asc(resumeLanguages.sortOrder));
    if (!isStoredResumeComplete({ ...resume, experiences, educations, languages })) return "resume-required";

    const [job] = await tx.select({ id: jobPosts.id }).from(jobPosts)
      .where(and(eq(jobPosts.id, jobPostId), publicJobConditions(now))).limit(1);
    if (!job) return "job-unavailable";

    const inserted = await tx.insert(jobApplications).values(
      buildApplicationInsert(candidateAccountId, resume.id, job.id),
    ).onConflictDoNothing({
      target: [jobApplications.candidateAccountId, jobApplications.jobPostId],
    }).returning({ id: jobApplications.id });

    return inserted.length ? "created" : "already-applied";
  });
}
