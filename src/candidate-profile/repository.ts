import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidateAccounts, candidateResumes } from "@/db/schema";
import type { CandidateBasicProfileValues } from "@/resume/validation";
import { buildCandidateBasicProfileUpdate } from "./policy";

export async function getCandidateBasicProfile(candidateAccountId: string) {
  const [row] = await db
    .select({
      candidateAccountId: candidateAccounts.id,
      email: candidateAccounts.email,
      mobile: candidateAccounts.mobile,
      resumeId: candidateResumes.id,
      firstName: candidateResumes.firstName,
      lastName: candidateResumes.lastName,
      city: candidateResumes.city,
      professionalTitle: candidateResumes.professionalTitle,
      professionalSummary: candidateResumes.professionalSummary,
      linkedinUrl: candidateResumes.linkedinUrl,
      portfolioUrl: candidateResumes.portfolioUrl,
      updatedAt: candidateResumes.updatedAt,
    })
    .from(candidateAccounts)
    .leftJoin(candidateResumes, eq(candidateResumes.candidateAccountId, candidateAccounts.id))
    .where(eq(candidateAccounts.id, candidateAccountId))
    .limit(1);
  return row ?? null;
}

export async function updateCandidateBasicProfile(
  authenticatedCandidateId: string,
  targetCandidateId: string,
  values: CandidateBasicProfileValues,
) {
  if (authenticatedCandidateId !== targetCandidateId) return false;
  const updated = await db
    .update(candidateResumes)
    .set({ ...buildCandidateBasicProfileUpdate(values), updatedAt: new Date() })
    .where(and(
      eq(candidateResumes.candidateAccountId, authenticatedCandidateId),
      eq(candidateResumes.candidateAccountId, targetCandidateId),
    ))
    .returning({ id: candidateResumes.id });
  return updated.length === 1;
}
