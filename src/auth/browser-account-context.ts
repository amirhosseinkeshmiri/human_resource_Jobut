import "server-only";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  candidateAccounts,
  candidateResumes,
  candidateSessions,
  companies,
  employerAccounts,
  employerSessions,
} from "@/db/schema";
import { digestSessionToken } from "./crypto";
import { candidateDisplayName, employerDisplayName, resolveBrowserAccountContext } from "./role-isolation-policy";
import { CANDIDATE_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE } from "./session-cookies";

async function findCandidate(token?: string) {
  if (!token) return null;
  const [account] = await db.select({ id: candidateAccounts.id })
    .from(candidateSessions)
    .innerJoin(candidateAccounts, eq(candidateSessions.candidateAccountId, candidateAccounts.id))
    .where(and(eq(candidateSessions.tokenDigest, digestSessionToken(token)), gt(candidateSessions.expiresAt, new Date())))
    .limit(1);
  return account ?? null;
}

async function findEmployer(token?: string) {
  if (!token) return null;
  const [account] = await db.select({ id: employerAccounts.id, email: employerAccounts.email, mobile: employerAccounts.mobile })
    .from(employerSessions)
    .innerJoin(employerAccounts, eq(employerSessions.employerAccountId, employerAccounts.id))
    .where(and(eq(employerSessions.tokenDigest, digestSessionToken(token)), gt(employerSessions.expiresAt, new Date())))
    .limit(1);
  return account ?? null;
}

export const getBrowserAccountContext = cache(async () => {
  const cookieStore = await cookies();
  const [candidate, employer] = await Promise.all([
    findCandidate(cookieStore.get(CANDIDATE_SESSION_COOKIE)?.value),
    findEmployer(cookieStore.get(EMPLOYER_SESSION_COOKIE)?.value),
  ]);
  const context = resolveBrowserAccountContext({
    candidateSessionValid: Boolean(candidate),
    employerSessionValid: Boolean(employer),
  });
  return { context, candidate, employer };
});

export const getBrowserNavigationIdentity = cache(async () => {
  const accountContext = await getBrowserAccountContext();
  if (accountContext.context === "candidate" && accountContext.candidate) {
    const [resume] = await db.select({ firstName: candidateResumes.firstName, lastName: candidateResumes.lastName })
      .from(candidateResumes)
      .where(eq(candidateResumes.candidateAccountId, accountContext.candidate.id))
      .limit(1);
    return { role: "candidate" as const, displayName: candidateDisplayName(resume?.firstName, resume?.lastName) };
  }
  if (accountContext.context === "employer" && accountContext.employer) {
    const [company] = await db.select({ name: companies.name })
      .from(companies)
      .where(eq(companies.employerAccountId, accountContext.employer.id))
      .limit(1);
    return { role: "employer" as const, displayName: employerDisplayName(company?.name) };
  }
  return accountContext.context === "conflict" ? { role: "conflict" as const, displayName: "نشست نامعتبر" } : null;
});
