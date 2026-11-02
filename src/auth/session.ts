import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employerSessions } from "@/db/schema";
import { getBrowserAccountContext } from "./browser-account-context";
import { destroyBrowserSessions } from "./browser-session";
import { createEmployerSessionMaterial } from "./session-material";
import { EMPLOYER_SESSION_COOKIE } from "./session-cookies";
import { sessionCookieOptions } from "./session-cookie-options";

export { EMPLOYER_SESSION_COOKIE } from "./session-cookies";

export async function createEmployerSession(employerAccountId: string) {
  const session = createEmployerSessionMaterial(employerAccountId);
  await db.insert(employerSessions).values(session.record);
  await setEmployerSessionCookie(session.token, session.record.expiresAt);
}

export async function setEmployerSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(EMPLOYER_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentEmployer() {
  const accountContext = await getBrowserAccountContext();
  return accountContext.context === "employer" ? accountContext.employer : null;
}

export async function requireEmployer() {
  const employer = await getCurrentEmployer();
  if (!employer) redirect("/login/employer");
  return employer;
}

export async function destroyEmployerSession() {
  await destroyBrowserSessions();
}
