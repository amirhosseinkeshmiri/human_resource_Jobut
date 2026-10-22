import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobApplications, jobPosts } from "@/db/schema";
import {
  CANDIDATE_DASHBOARD_RECENT_APPLICATION_LIMIT,
  normalizeCandidateApplicationMetrics,
} from "./candidate-policy";

export async function getCandidateDashboardApplicationMetrics(candidateAccountId: string) {
  const [metrics] = await db.select({
    total: sql<number>`count(*)`.mapWith(Number),
    received: sql<number>`count(*) filter (where ${jobApplications.status} = 'received')`.mapWith(Number),
    reviewing: sql<number>`count(*) filter (where ${jobApplications.status} = 'reviewing')`.mapWith(Number),
    interview: sql<number>`count(*) filter (where ${jobApplications.status} = 'interview')`.mapWith(Number),
    rejected: sql<number>`count(*) filter (where ${jobApplications.status} = 'rejected')`.mapWith(Number),
    hired: sql<number>`count(*) filter (where ${jobApplications.status} = 'hired')`.mapWith(Number),
  }).from(jobApplications)
    .where(eq(jobApplications.candidateAccountId, candidateAccountId));

  return normalizeCandidateApplicationMetrics(metrics);
}

export async function getCandidateDashboardRecentApplications(candidateAccountId: string) {
  return db.select({
    id: jobApplications.id,
    createdAt: jobApplications.createdAt,
    status: jobApplications.status,
    jobPostId: jobPosts.id,
    jobTitle: jobPosts.title,
    companyName: companies.name,
  }).from(jobApplications)
    .innerJoin(jobPosts, eq(jobApplications.jobPostId, jobPosts.id))
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(eq(jobApplications.candidateAccountId, candidateAccountId))
    .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
    .limit(CANDIDATE_DASHBOARD_RECENT_APPLICATION_LIMIT);
}
