import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { candidateSavedJobs, companies, jobPosts } from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import { getSavedJobsOffset, getSavedJobsPageCount, SAVED_JOBS_PAGE_SIZE } from "./policy";

export async function getCandidateSavedJobIds(candidateAccountId: string, jobPostIds: string[]) {
  if (!jobPostIds.length) return new Set<string>();
  const rows = await db.select({ jobPostId: candidateSavedJobs.jobPostId })
    .from(candidateSavedJobs)
    .where(and(
      eq(candidateSavedJobs.candidateAccountId, candidateAccountId),
      inArray(candidateSavedJobs.jobPostId, jobPostIds),
    ));
  return new Set(rows.map((row) => row.jobPostId));
}

export async function isCandidateJobSaved(candidateAccountId: string, jobPostId: string) {
  const [row] = await db.select({ jobPostId: candidateSavedJobs.jobPostId })
    .from(candidateSavedJobs)
    .where(and(
      eq(candidateSavedJobs.candidateAccountId, candidateAccountId),
      eq(candidateSavedJobs.jobPostId, jobPostId),
    ))
    .limit(1);
  return Boolean(row);
}

export async function getCandidateSavedJobs(candidateAccountId: string, requestedPage: number, now = new Date()) {
  const [totalRow] = await db.select({ value: count() })
    .from(candidateSavedJobs)
    .where(eq(candidateSavedJobs.candidateAccountId, candidateAccountId));
  const total = totalRow.value;
  const pageCount = getSavedJobsPageCount(total);
  const page = Math.min(requestedPage, pageCount);
  const jobs = await db.select({
    jobPostId: jobPosts.id,
    title: jobPosts.title,
    companyName: companies.name,
    location: jobPosts.location,
    workplaceType: jobPosts.workplaceType,
    employmentType: jobPosts.employmentType,
    seniorityLevel: jobPosts.seniorityLevel,
    savedAt: candidateSavedJobs.savedAt,
    isPublic: publicJobConditions(now).mapWith(Boolean),
  })
    .from(candidateSavedJobs)
    .innerJoin(jobPosts, eq(candidateSavedJobs.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(eq(candidateSavedJobs.candidateAccountId, candidateAccountId))
    .orderBy(desc(candidateSavedJobs.savedAt), desc(candidateSavedJobs.jobPostId))
    .limit(SAVED_JOBS_PAGE_SIZE)
    .offset(getSavedJobsOffset(page));
  return { jobs, total, page, pageCount };
}
