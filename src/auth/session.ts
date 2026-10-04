import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employerAccounts, employerSessions } from "@/db/schema";
import { digestSessionToken } from "./crypto";
import { createEmployerSessionMaterial } from "./session-material";

export const EMPLOYER_SESSION_COOKIE = "jobut_employer_session";

export async function createEmployerSession(employerAccountId: string) {
  const session = createEmployerSessionMaterial(employerAccountId);
  await db.insert(employerSessions).values(session.record);
  await setEmployerSessionCookie(session.token, session.record.expiresAt);
}

export async function setEmployerSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(EMPLOYER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentEmployer() {
  const token = (await cookies()).get(EMPLOYER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [employer] = await db
    .select({
      id: employerAccounts.id,
      email: employerAccounts.email,
      mobile: employerAccounts.mobile,
    })
    .from(employerSessions)
    .innerJoin(employerAccounts, eq(employerSessions.employerAccountId, employerAccounts.id))
    .where(
      and(
        eq(employerSessions.tokenDigest, digestSessionToken(token)),
        gt(employerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return employer ?? null;
}

export async function requireEmployer() {
  const employer = await getCurrentEmployer();
  if (!employer) redirect("/login/employer");
  return employer;
}

export async function destroyEmployerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(EMPLOYER_SESSION_COOKIE)?.value;

  if (token) {
    await db
      .delete(employerSessions)
      .where(eq(employerSessions.tokenDigest, digestSessionToken(token)));
  }

  cookieStore.set(EMPLOYER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
