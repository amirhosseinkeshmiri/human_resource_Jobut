import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateResumes,
  applicationResumeSnapshotEducations,
  applicationResumeSnapshotExperiences,
  applicationResumeSnapshotLanguages,
  applicationResumeSnapshots,
  jobApplications,
  jobPosts,
  resumeEducations,
  resumeExperiences,
  resumeLanguages,
} from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { isStoredResumeComplete } from "@/resume/policy";
import { candidateResumeLockKey } from "@/resume/locking";
import { buildApplicationInsert } from "./policy";

export type CreateApplicationResult = "created" | "already-applied" | "resume-required" | "job-unavailable";

export async function createCandidateApplication(
  candidateAccountId: string,
  jobPostId: string,
  now = new Date(),
): Promise<CreateApplicationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${candidateResumeLockKey(candidateAccountId)}, 0))`,
    );

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

    const [inserted] = await tx.insert(jobApplications).values(
      buildApplicationInsert(candidateAccountId, resume.id, job.id),
    ).onConflictDoNothing({
      target: [jobApplications.candidateAccountId, jobApplications.jobPostId],
    }).returning({ id: jobApplications.id });

    if (!inserted) return "already-applied";

    await tx.insert(applicationResumeSnapshots).values({
      jobApplicationId: inserted.id,
      firstName: resume.firstName,
      lastName: resume.lastName,
      city: resume.city,
      professionalTitle: resume.professionalTitle,
      professionalSummary: resume.professionalSummary,
      skills: [...resume.skills],
      linkedinUrl: resume.linkedinUrl,
      portfolioUrl: resume.portfolioUrl,
      capturedAt: now,
    });

    if (experiences.length) {
      await tx.insert(applicationResumeSnapshotExperiences).values(
        experiences.map((item) => ({
          jobApplicationId: inserted.id,
          jobTitle: item.jobTitle,
          companyName: item.companyName,
          startDate: item.startDate,
          endDate: item.endDate,
          isCurrent: item.isCurrent,
          description: item.description,
          sortOrder: item.sortOrder,
        })),
      );
    }
    if (educations.length) {
      await tx.insert(applicationResumeSnapshotEducations).values(
        educations.map((item) => ({
          jobApplicationId: inserted.id,
          fieldOfStudy: item.fieldOfStudy,
          institutionName: item.institutionName,
          degree: item.degree,
          startDate: item.startDate,
          endDate: item.endDate,
          isCurrent: item.isCurrent,
          sortOrder: item.sortOrder,
        })),
      );
    }
    if (languages.length) {
      await tx.insert(applicationResumeSnapshotLanguages).values(
        languages.map((item) => ({
          jobApplicationId: inserted.id,
          name: item.name,
          proficiency: item.proficiency,
          sortOrder: item.sortOrder,
        })),
      );
    }

    return "created";
  });
}
