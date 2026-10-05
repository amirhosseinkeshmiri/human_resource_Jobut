import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companyJobCreditTransactions, jobPosts } from "@/db/schema";

export async function getEmployerDashboardMetrics(companyId: string) {
  const [[activeJobs], [remainingCredits]] = await Promise.all([
    db
      .select({ value: count() })
      .from(jobPosts)
      .where(and(eq(jobPosts.companyId, companyId), eq(jobPosts.status, "published"))),
    db
      .select({
        value: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(companyJobCreditTransactions)
      .where(eq(companyJobCreditTransactions.companyId, companyId)),
  ]);

  return {
    activeJobPosts: activeJobs.value,
    remainingJobCredits: remainingCredits.value,
  };
}
