import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobApplications, jobPosts } from "@/db/schema";

export async function getCompanyJobPosts(companyId: string) {
  const applicationCounts = db.select({
    jobPostId: jobApplications.jobPostId,
    value: count().as("application_count"),
  }).from(jobApplications).groupBy(jobApplications.jobPostId).as("application_counts");
  return db.select({
    id: jobPosts.id,
    title: jobPosts.title,
    status: jobPosts.status,
    createdAt: jobPosts.createdAt,
    updatedAt: jobPosts.updatedAt,
    applicationCount: sql<number>`coalesce(${applicationCounts.value}, 0)`.mapWith(Number),
  }).from(jobPosts)
    .leftJoin(applicationCounts, eq(jobPosts.id, applicationCounts.jobPostId))
    .where(eq(jobPosts.companyId, companyId)).orderBy(desc(jobPosts.createdAt));
}

export async function getCompanyJobPost(companyId: string, jobId: string) {
  const [job] = await db.select({
    id: jobPosts.id,
    companyId: jobPosts.companyId,
    title: jobPosts.title,
    status: jobPosts.status,
    createdAt: jobPosts.createdAt,
    updatedAt: jobPosts.updatedAt,
    workplaceType: jobPosts.workplaceType,
    employmentType: jobPosts.employmentType,
    location: jobPosts.location,
    seniorityLevel: jobPosts.seniorityLevel,
    salaryMin: jobPosts.salaryMin,
    salaryMax: jobPosts.salaryMax,
    salaryNegotiable: jobPosts.salaryNegotiable,
    requiredSkills: jobPosts.requiredSkills,
    description: jobPosts.description,
    publishedAt: jobPosts.publishedAt,
    expiresAt: jobPosts.expiresAt,
  }).from(jobPosts).where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId))).limit(1);
  return job ?? null;
}
