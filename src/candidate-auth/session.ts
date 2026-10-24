import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { candidateAccounts, candidateSessions } from "@/db/schema";
import { digestSessionToken } from "@/auth/crypto";
import { CANDIDATE_SESSION_COOKIE } from "@/auth/session-cookies";
import { sessionCookieOptions } from "@/auth/session-cookie-options";

export { CANDIDATE_SESSION_COOKIE } from "@/auth/session-cookies";

export async function setCandidateSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(CANDIDATE_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentCandidate() {
  const token = (await cookies()).get(CANDIDATE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [candidate] = await db
    .select({ id: candidateAccounts.id })
    .from(candidateSessions)
    .innerJoin(candidateAccounts, eq(candidateSessions.candidateAccountId, candidateAccounts.id))
    .where(
      and(
        eq(candidateSessions.tokenDigest, digestSessionToken(token)),
        gt(candidateSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return candidate ?? null;
}

export async function requireCandidate() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/login/candidate");
  return candidate;
}

export async function destroyCandidateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CANDIDATE_SESSION_COOKIE)?.value;

  if (token) {
    await db
      .delete(candidateSessions)
      .where(eq(candidateSessions.tokenDigest, digestSessionToken(token)));
  }

  cookieStore.set(CANDIDATE_SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
}
