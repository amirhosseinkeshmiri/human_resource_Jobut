import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { digestSessionToken } from "@/auth/crypto";
import { ADMIN_SESSION_COOKIE } from "@/auth/session-cookies";
import { db } from "@/db";
import { adminAccounts, adminSessions } from "@/db/schema";
import { sessionCookieOptions } from "@/auth/session-cookie-options";

export { ADMIN_SESSION_COOKIE } from "@/auth/session-cookies";

export async function setAdminSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentAdmin() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [admin] = await db
    .select({ id: adminAccounts.id })
    .from(adminSessions)
    .innerJoin(adminAccounts, eq(adminSessions.adminAccountId, adminAccounts.id))
    .where(
      and(
        eq(adminSessions.tokenDigest, digestSessionToken(token)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return admin ?? null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.tokenDigest, digestSessionToken(token)));
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
}
