import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobApplications, jobPosts } from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { getCandidateResume } from "@/resume/queries";
import { isStoredResumeComplete } from "@/resume/policy";

export async function getCandidateApplyState(candidateAccountId: string, jobPostId: string) {
  const [resume, existing] = await Promise.all([
    getCandidateResume(candidateAccountId),
    db.select({ id: jobApplications.id }).from(jobApplications).where(and(
      eq(jobApplications.candidateAccountId, candidateAccountId),
      eq(jobApplications.jobPostId, jobPostId),
    )).limit(1),
  ]);
  return {
    resumeComplete: resume ? isStoredResumeComplete(resume) : false,
    alreadyApplied: Boolean(existing[0]),
  };
}

export async function getCandidateApplications(candidateAccountId: string, now = new Date()) {
  const rows = await db.select({
    id: jobApplications.id,
    createdAt: jobApplications.createdAt,
    applicationStatus: jobApplications.status,
    jobPostId: jobPosts.id,
    jobTitle: jobPosts.title,
    jobLocation: jobPosts.location,
    companyName: companies.name,
    jobStatus: jobPosts.status,
    publishedAt: jobPosts.publishedAt,
    expiresAt: jobPosts.expiresAt,
    isPublic: publicJobConditions(now).mapWith(Boolean),
  }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(eq(jobApplications.candidateAccountId, candidateAccountId))
    .orderBy(desc(jobApplications.createdAt))
    .limit(50);

  return rows;
}

export async function countCandidateApplications(candidateAccountId: string) {
  const [result] = await db.select({ value: count() }).from(jobApplications)
    .where(eq(jobApplications.candidateAccountId, candidateAccountId));
  return result.value;
}
