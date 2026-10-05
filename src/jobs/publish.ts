import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyJobCreditTransactions, jobPosts } from "@/db/schema";
import { getPublishCreditDecision, getPublishEligibility } from "./policy";

export type PublishJobErrorCode =
  | "not-found"
  | "not-draft"
  | "insufficient-credit"
  | "conflict";

export class PublishJobError extends Error {
  constructor(public readonly code: PublishJobErrorCode) {
    super(code);
    this.name = "PublishJobError";
  }
}

/**
 * Publishes one Company-owned draft and consumes exactly one ledger credit.
 * The Company row lock serializes all credit-consuming publications for that Company.
 */
export async function publishJobPost(companyId: string, jobId: string) {
  return db.transaction(async (transaction) => {
    const [lockedCompany] = await transaction
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)
      .for("update");

    if (!lockedCompany) throw new PublishJobError("not-found");

    const [job] = await transaction
      .select({
        id: jobPosts.id,
        companyId: jobPosts.companyId,
        status: jobPosts.status,
      })
      .from(jobPosts)
      .where(and(eq(jobPosts.id, jobId), eq(jobPosts.companyId, companyId)))
      .limit(1)
      .for("update");

    const eligibility = getPublishEligibility(job ?? null, companyId);
    if (eligibility === "not-found") throw new PublishJobError("not-found");
    if (eligibility === "not-draft") throw new PublishJobError("not-draft");

    const [creditResult] = await transaction
      .select({
        balance: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(companyJobCreditTransactions)
      .where(eq(companyJobCreditTransactions.companyId, companyId));

    const creditDecision = getPublishCreditDecision(creditResult.balance);
    if (!creditDecision.allowed) throw new PublishJobError("insufficient-credit");

    const [publishedJob] = await transaction
      .update(jobPosts)
      .set({ status: "published", updatedAt: new Date() })
      .where(
        and(
          eq(jobPosts.id, jobId),
          eq(jobPosts.companyId, companyId),
          eq(jobPosts.status, "draft"),
        ),
      )
      .returning({ id: jobPosts.id });

    if (!publishedJob) throw new PublishJobError("conflict");

    await transaction.insert(companyJobCreditTransactions).values({
      companyId,
      amount: creditDecision.debitAmount,
    });

    return { published: true, debitAmount: creditDecision.debitAmount } as const;
  });
}
