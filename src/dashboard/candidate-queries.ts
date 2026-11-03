import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobApplications, jobPosts } from "@/db/schema";
import {
  CANDIDATE_DASHBOARD_RECENT_APPLICATION_LIMIT,
  normalizeCandidateApplicationMetrics,
} from "./candidate-policy";

export async function getCandidateDashboardApplicationMetrics(candidateAccountId: string) {
  const rows = await db.select({ status: jobApplications.status, value: count() })
    .from(jobApplications)
    .where(eq(jobApplications.candidateAccountId, candidateAccountId))
    .groupBy(jobApplications.status);
  const metrics = { total: 0, received: 0, reviewing: 0, interview: 0, rejected: 0, hired: 0, withdrawn: 0 };
  for (const row of rows) {
    metrics[row.status] = row.value;
    metrics.total += row.value;
  }
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
