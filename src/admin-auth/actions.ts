"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  MAX_VERIFICATION_ATTEMPTS,
  getChallengeAvailability,
} from "@/auth/challenge-policy";
import {
  digestVerificationCode,
  getAuthSecret,
  verificationCodeMatches,
} from "@/auth/crypto";
import { hasDevelopmentDelivery } from "@/auth/delivery";
import { isBoundedAuthFormData } from "@/auth/form-security";
import { normalizeAuthIdentifier, normalizeVerificationCode } from "@/auth/identifier";
import {
  ChallengeCooldownError,
  isWithinVerificationCodeCooldown,
  issueVerificationChallenge,
} from "@/auth/issue-challenge";
import { isTrustedAuthActionRequest } from "@/auth/request-security";
import { authorizeSmsChallenge } from "@/auth/sms/rate-limit";
import { createAdminSessionMaterial } from "@/auth/session-material";
import { db } from "@/db";
import { adminAccounts, adminAuthChallenges, adminSessions } from "@/db/schema";
import { canCreateAdminSession, canIssueAdminChallenge } from "./policy";
import {
  ADMIN_VERIFICATION_FAILURE_MESSAGE,
  issueAdminChallengeIndistinguishably,
} from "./request-outcome";
import { destroyAdminSession, setAdminSessionCookie } from "./session";

export interface AdminRequestCodeState {
  status: "idle" | "error" | "challenge";
  message?: string;
  challengeId?: string;
  identifier?: string;
  developmentCode?: string;
}

export interface AdminVerifyCodeState {
  status: "idle" | "error";
  message?: string;
}

export async function requestAdminVerificationCode(
  _previousState: AdminRequestCodeState,
  formData: FormData,
): Promise<AdminRequestCodeState> {
  if (!(await isTrustedAuthActionRequest())) {
    return { status: "error", message: "درخواست ارسال کد معتبر نیست." };
  }
  if (!isBoundedAuthFormData(formData, ["identifier"])) {
    return { status: "error", message: "درخواست ارسال کد معتبر نیست." };
  }
  const rawIdentifier = formData.get("identifier");
  const identifier = normalizeAuthIdentifier(
    typeof rawIdentifier === "string" ? rawIdentifier : "",
  );
  if (!identifier) {
    return { status: "error", message: "شناسه ورود معتبر نیست." };
  }
  try {
    const [account] = await db
      .select({ id: adminAccounts.id })
      .from(adminAccounts)
      .where(
        identifier.type === "email"
          ? eq(adminAccounts.email, identifier.value)
          : eq(adminAccounts.mobile, identifier.value),
      )
      .limit(1);

    return issueAdminChallengeIndistinguishably(
      identifier,
      canIssueAdminChallenge(account?.id),
      {
        developmentDelivery: hasDevelopmentDelivery(),
        authorizeUnknownIdentifier: () => authorizeSmsChallenge("admin", identifier),
        issueKnownChallenge: () =>
          issueVerificationChallenge(identifier, {
            authorize: () => authorizeSmsChallenge("admin", identifier),
            reserve: async ({ id, pendingDigest, pendingExpiresAt }) => {
              await db.transaction(async (transaction) => {
                await transaction.execute(
                  sql`select pg_advisory_xact_lock(hashtextextended(${`admin-auth:${identifier.value}`}, 0))`,
                );
                const [latest] = await transaction
                  .select({ createdAt: adminAuthChallenges.createdAt })
                  .from(adminAuthChallenges)
                  .where(eq(adminAuthChallenges.identifier, identifier.value))
                  .orderBy(desc(adminAuthChallenges.createdAt))
                  .limit(1);
                if (latest && isWithinVerificationCodeCooldown(latest.createdAt)) {
                  throw new ChallengeCooldownError();
                }
                await transaction
                  .update(adminAuthChallenges)
                  .set({ consumedAt: new Date() })
                  .where(
                    and(
                      eq(adminAuthChallenges.identifier, identifier.value),
                      isNull(adminAuthChallenges.consumedAt),
                    ),
                  );
                await transaction.insert(adminAuthChallenges).values({
                  id,
                  identifier: identifier.value,
                  identifierType: identifier.type,
                  codeDigest: pendingDigest,
                  expiresAt: pendingExpiresAt,
                });
              });
            },
            activate: async ({ id, codeDigest, expiresAt }) => {
              return db.transaction(async (transaction) => {
                await transaction.execute(
                  sql`select pg_advisory_xact_lock(hashtextextended(${`admin-auth:${identifier.value}`}, 0))`,
                );
                const [activated] = await transaction
                  .update(adminAuthChallenges)
                  .set({ codeDigest, expiresAt, attempts: 0 })
                  .where(
                    and(
                      eq(adminAuthChallenges.id, id),
                      eq(adminAuthChallenges.identifier, identifier.value),
                      isNull(adminAuthChallenges.consumedAt),
                    ),
                  )
                  .returning({ id: adminAuthChallenges.id });
                return Boolean(activated);
              });
            },
            invalidate: async (id) => {
              await db
                .update(adminAuthChallenges)
                .set({ consumedAt: new Date() })
                .where(
                  and(
                    eq(adminAuthChallenges.id, id),
                    isNull(adminAuthChallenges.consumedAt),
                  ),
                );
            },
          }),
      },
    );
  } catch {
    return issueAdminChallengeIndistinguishably(identifier, false, {
      developmentDelivery: hasDevelopmentDelivery(),
      authorizeUnknownIdentifier: async () => undefined,
      issueKnownChallenge: async () => {
        throw new Error("unreachable");
      },
    });
  }
}

export async function verifyAdminCode(
  _previousState: AdminVerifyCodeState,
  formData: FormData,
): Promise<AdminVerifyCodeState> {
  if (!isBoundedAuthFormData(formData, ["challengeId", "code"])) {
    return { status: "error", message: "درخواست ورود معتبر نیست. دوباره تلاش کنید." };
  }
  const challengeId = formData.get("challengeId");
  const code = normalizeVerificationCode(formData.get("code"));
  if (typeof challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return { status: "error", message: "درخواست ورود معتبر نیست. دوباره تلاش کنید." };
  }
  if (!code) return { status: "error", message: "کد ورود باید ۶ رقم باشد." };

  const session = await db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(adminAuthChallenges)
      .where(eq(adminAuthChallenges.id, challengeId))
      .limit(1)
      .for("update");

    if (!challenge) return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;
    const availability = getChallengeAvailability(challenge);
    if (availability === "expired") {
      await transaction.update(adminAuthChallenges).set({ consumedAt: new Date() }).where(eq(adminAuthChallenges.id, challenge.id));
      return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;
    }
    if (availability === "consumed") return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;
    if (availability === "attempts-exhausted") return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;

    const actualDigest = digestVerificationCode(challenge.id, code, getAuthSecret());
    if (!verificationCodeMatches(challenge.codeDigest, actualDigest)) {
      const attempts = challenge.attempts + 1;
      await transaction
        .update(adminAuthChallenges)
        .set({ attempts, consumedAt: attempts >= MAX_VERIFICATION_ATTEMPTS ? new Date() : null })
        .where(eq(adminAuthChallenges.id, challenge.id));
      return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;
    }

    const [account] = await transaction
      .select({ id: adminAccounts.id })
      .from(adminAccounts)
      .where(
        challenge.identifierType === "email"
          ? eq(adminAccounts.email, challenge.identifier)
          : eq(adminAccounts.mobile, challenge.identifier),
      )
      .limit(1);
    if (!canCreateAdminSession(account?.id, true)) {
      await transaction.update(adminAuthChallenges).set({ consumedAt: new Date() }).where(eq(adminAuthChallenges.id, challenge.id));
      return { error: ADMIN_VERIFICATION_FAILURE_MESSAGE } as const;
    }

    const sessionMaterial = createAdminSessionMaterial(account.id);
    await transaction.insert(adminSessions).values(sessionMaterial.record);
    await transaction.update(adminAuthChallenges).set({ consumedAt: new Date() }).where(eq(adminAuthChallenges.id, challenge.id));
    return sessionMaterial;
  });

  if ("error" in session) return { status: "error", message: session.error };
  await setAdminSessionCookie(session.token, session.record.expiresAt);
  redirect("/admin");
}

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}
