import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminPageAccessPolicy } from "@/admin-auth/authorization-policy";
import { requireAdminPermission, type ActiveAdminPrincipal } from "@/admin-auth/rbac-guards";
import {
  candidateAccounts,
  companies,
  companyJobCreditTransactions,
  jobPosts,
  packagePurchases,
} from "@/db/schema";

export const PAID_PURCHASE_STATUS = "paid" as const;

export async function getAdminDashboardMetrics(principal: ActiveAdminPrincipal) {
  await requireAdminPermission(adminPageAccessPolicy.dashboard, principal);
  const [[totalJobs], [publishedJobs], [companyCount], [candidateCount], [paidPurchases], [credits]] = await Promise.all([
    db.select({ value: count() }).from(jobPosts),
    db.select({ value: count() }).from(jobPosts).where(eq(jobPosts.status, "published")),
    db.select({ value: count() }).from(companies),
    db.select({ value: count() }).from(candidateAccounts),
    db.select({
      value: sql<number>`coalesce(sum(${packagePurchases.priceToman}), 0)`.mapWith(Number),
    }).from(packagePurchases).where(eq(packagePurchases.status, PAID_PURCHASE_STATUS)),
    db.select({
      value: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(Number),
    }).from(companyJobCreditTransactions),
  ]);

  return {
    totalJobPosts: totalJobs.value,
    publishedJobPosts: publishedJobs.value,
    companies: companyCount.value,
    candidateAccounts: candidateCount.value,
    paidPurchaseAmountToman: paidPurchases.value,
    totalEmployerCredits: credits.value,
  };
}
