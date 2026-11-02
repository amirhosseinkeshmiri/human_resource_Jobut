import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateLegalAcceptances } from "@/db/schema";
import type { LegalDocumentVersions } from "./policy";

export async function findCurrentCandidateLegalAcceptance(
  candidateAccountId: string,
  versions: LegalDocumentVersions,
) {
  const [acceptance] = await db.select({
    candidateAccountId: candidateLegalAcceptances.candidateAccountId,
    termsVersion: candidateLegalAcceptances.termsVersion,
    privacyVersion: candidateLegalAcceptances.privacyVersion,
    acceptedAt: candidateLegalAcceptances.acceptedAt,
  }).from(candidateLegalAcceptances).where(and(
    eq(candidateLegalAcceptances.candidateAccountId, candidateAccountId),
    eq(candidateLegalAcceptances.termsVersion, versions.termsVersion),
    eq(candidateLegalAcceptances.privacyVersion, versions.privacyVersion),
  )).orderBy(desc(candidateLegalAcceptances.acceptedAt)).limit(1);
  return acceptance ?? null;
}

export async function recordCandidateLegalAcceptance(
  candidateAccountId: string,
  versions: LegalDocumentVersions,
) {
  const inserted = await db.insert(candidateLegalAcceptances).values({
    candidateAccountId,
    termsVersion: versions.termsVersion,
    privacyVersion: versions.privacyVersion,
  }).onConflictDoNothing({
    target: [
      candidateLegalAcceptances.candidateAccountId,
      candidateLegalAcceptances.termsVersion,
      candidateLegalAcceptances.privacyVersion,
    ],
  }).returning({ id: candidateLegalAcceptances.id });
  return inserted.length === 1 ? "created" as const : "already-accepted" as const;
}
