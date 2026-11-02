import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidateDataRequests, candidateDataRequestStatusEvents } from "@/db/schema";
import { ACTIVE_CANDIDATE_DATA_REQUEST_STATUSES, type CandidateDataRequestType } from "./policy";

export async function listCandidateDataRequests(candidateAccountId: string) {
  return db.select({
    id: candidateDataRequests.id,
    requestType: candidateDataRequests.requestType,
    status: candidateDataRequests.status,
    createdAt: candidateDataRequests.createdAt,
    updatedAt: candidateDataRequests.updatedAt,
    resolvedAt: candidateDataRequests.resolvedAt,
  }).from(candidateDataRequests)
    .where(eq(candidateDataRequests.candidateAccountId, candidateAccountId))
    .orderBy(desc(candidateDataRequests.createdAt))
    .limit(50);
}

export async function createCandidateDataRequest(
  candidateAccountId: string,
  requestType: CandidateDataRequestType,
) {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`candidate-data-request:${candidateAccountId}:${requestType}`}, 0))`);
    const [existing] = await transaction.select({ id: candidateDataRequests.id })
      .from(candidateDataRequests)
      .where(and(
        eq(candidateDataRequests.candidateAccountId, candidateAccountId),
        eq(candidateDataRequests.requestType, requestType),
        inArray(candidateDataRequests.status, [...ACTIVE_CANDIDATE_DATA_REQUEST_STATUSES]),
      )).limit(1);
    if (existing) return "already-active" as const;

    const [request] = await transaction.insert(candidateDataRequests).values({
      candidateAccountId,
      requestType,
    }).onConflictDoNothing().returning({ id: candidateDataRequests.id });
    if (!request) return "already-active" as const;
    await transaction.insert(candidateDataRequestStatusEvents).values({
      requestId: request.id,
      fromStatus: null,
      toStatus: "pending",
      source: "candidate",
    });
    return "created" as const;
  });
}
