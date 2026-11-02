import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { candidateSessions, employerSessions } from "@/db/schema";
import { digestSessionToken } from "./crypto";
import { sessionCookieOptions } from "./session-cookie-options";
import { CANDIDATE_SESSION_COOKIE, EMPLOYER_SESSION_COOKIE } from "./session-cookies";

export async function getBrowserSessionTokens() {
  const cookieStore = await cookies();
  return {
    candidateToken: cookieStore.get(CANDIDATE_SESSION_COOKIE)?.value,
    employerToken: cookieStore.get(EMPLOYER_SESSION_COOKIE)?.value,
  };
}

export async function clearBrowserSessionCookies() {
  const cookieStore = await cookies();
  const expired = sessionCookieOptions(new Date(0));
  cookieStore.set(CANDIDATE_SESSION_COOKIE, "", expired);
  cookieStore.set(EMPLOYER_SESSION_COOKIE, "", expired);
}

export async function destroyBrowserSessions() {
  const { candidateToken, employerToken } = await getBrowserSessionTokens();
  await db.transaction(async (transaction) => {
    if (candidateToken) await transaction.delete(candidateSessions).where(eq(candidateSessions.tokenDigest, digestSessionToken(candidateToken)));
    if (employerToken) await transaction.delete(employerSessions).where(eq(employerSessions.tokenDigest, digestSessionToken(employerToken)));
  });
  await clearBrowserSessionCookies();
}
