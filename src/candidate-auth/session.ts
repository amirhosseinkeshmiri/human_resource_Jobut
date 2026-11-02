import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBrowserAccountContext } from "@/auth/browser-account-context";
import { destroyBrowserSessions } from "@/auth/browser-session";
import { CANDIDATE_SESSION_COOKIE } from "@/auth/session-cookies";
import { sessionCookieOptions } from "@/auth/session-cookie-options";

export { CANDIDATE_SESSION_COOKIE } from "@/auth/session-cookies";

export async function setCandidateSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(CANDIDATE_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentCandidate() {
  const accountContext = await getBrowserAccountContext();
  return accountContext.context === "candidate" ? accountContext.candidate : null;
}

export async function requireCandidate() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/login/candidate");
  return candidate;
}

export async function destroyCandidateSession() {
  await destroyBrowserSessions();
}
