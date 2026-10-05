import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companyJobCreditTransactions, jobPosts } from "@/db/schema";
import { ACTIVE_JOB_STATUS } from "@/jobs/policy";

export async function getEmployerDashboardMetrics(companyId: string) {
  const [[activeJobs], remainingJobCredits] = await Promise.all([
    db
      .select({ value: count() })
      .from(jobPosts)
      .where(and(eq(jobPosts.companyId, companyId), eq(jobPosts.status, ACTIVE_JOB_STATUS))),
    getRemainingJobCredits(companyId),
  ]);

  return {
    activeJobPosts: activeJobs.value,
    remainingJobCredits,
  };
}

export async function getRemainingJobCredits(companyId: string) {
  const [result] = await db
    .select({
      value: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(
        Number,
      ),
    })
    .from(companyJobCreditTransactions)
    .where(eq(companyJobCreditTransactions.companyId, companyId));

  return result.value;
}
