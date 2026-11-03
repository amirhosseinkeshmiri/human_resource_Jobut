import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobApplications, jobApplicationStatusHistory } from "@/db/schema";
import { buildApplicationStatusHistoryInsert } from "./status-history-policy";
import { resolveCandidateWithdrawal } from "./withdrawal-policy";

export type CandidateWithdrawalResult = "withdrawn" | "already-withdrawn" | "not-allowed" | "not-found" | "stale";

export async function withdrawCandidateApplication(candidateAccountId: string, applicationId: string): Promise<CandidateWithdrawalResult> {
  return db.transaction(async (transaction) => {
    const [application] = await transaction.select({ id: jobApplications.id, status: jobApplications.status })
      .from(jobApplications)
      .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.candidateAccountId, candidateAccountId)))
      .limit(1)
      .for("update");
    if (!application) return "not-found";
    const decision = resolveCandidateWithdrawal(application.status);
    if (decision !== "withdraw") return decision;
    const updated = await transaction.update(jobApplications)
      .set({ status: "withdrawn" })
      .where(and(
        eq(jobApplications.id, application.id),
        eq(jobApplications.candidateAccountId, candidateAccountId),
        eq(jobApplications.status, application.status),
      ))
      .returning({ id: jobApplications.id });
    if (updated.length !== 1) return "stale";
    await transaction.insert(jobApplicationStatusHistory).values(
      buildApplicationStatusHistoryInsert(application.id, application.status, "withdrawn"),
    );
    return "withdrawn";
  });
}
