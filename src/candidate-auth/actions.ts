"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { candidateAccounts, candidateAuthChallenges, candidateSessions } from "@/db/schema";
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
import { createCandidateSessionMaterial } from "@/auth/session-material";
import { destroyCandidateSession, setCandidateSessionCookie } from "./session";

export interface CandidateRequestCodeState {
  status: "idle" | "error" | "challenge";
  message?: string;
  challengeId?: string;
  identifier?: string;
  developmentCode?: string;
}

export interface CandidateVerifyCodeState {
  status: "idle" | "error";
  message?: string;
}

export async function requestCandidateVerificationCode(
  _previousState: CandidateRequestCodeState,
  formData: FormData,
): Promise<CandidateRequestCodeState> {
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
    return { status: "error", message: "ایمیل یا شماره موبایل ایرانی معتبر وارد کنید." };
  }

  if (identifier.type === "email" && !hasDevelopmentDelivery()) {
    return {
      status: "error",
      message: "ارسال کد ورود هنوز برای محیط اصلی پیکربندی نشده است.",
    };
  }

  let issued;
  try {
    issued = await issueVerificationChallenge(identifier, {
      authorize: () => authorizeSmsChallenge("candidate", identifier),
      reserve: async ({ id, pendingDigest, pendingExpiresAt }) => {
        await db.transaction(async (transaction) => {
          await transaction.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`candidate-auth:${identifier.value}`}, 0))`,
          );
          const [latest] = await transaction
            .select({ createdAt: candidateAuthChallenges.createdAt })
            .from(candidateAuthChallenges)
            .where(eq(candidateAuthChallenges.identifier, identifier.value))
            .orderBy(desc(candidateAuthChallenges.createdAt))
            .limit(1);
          if (latest && isWithinVerificationCodeCooldown(latest.createdAt)) {
            throw new ChallengeCooldownError();
          }
          await transaction
            .update(candidateAuthChallenges)
            .set({ consumedAt: new Date() })
            .where(
              and(
                eq(candidateAuthChallenges.identifier, identifier.value),
                isNull(candidateAuthChallenges.consumedAt),
              ),
            );
          await transaction.insert(candidateAuthChallenges).values({
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
            sql`select pg_advisory_xact_lock(hashtextextended(${`candidate-auth:${identifier.value}`}, 0))`,
          );
          const [activated] = await transaction
            .update(candidateAuthChallenges)
            .set({ codeDigest, expiresAt, attempts: 0 })
            .where(
              and(
                eq(candidateAuthChallenges.id, id),
                eq(candidateAuthChallenges.identifier, identifier.value),
                isNull(candidateAuthChallenges.consumedAt),
              ),
            )
            .returning({ id: candidateAuthChallenges.id });
          return Boolean(activated);
        });
      },
      invalidate: async (id) => {
        await db
          .update(candidateAuthChallenges)
          .set({ consumedAt: new Date() })
          .where(and(eq(candidateAuthChallenges.id, id), isNull(candidateAuthChallenges.consumedAt)));
      },
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ChallengeCooldownError
          ? "برای دریافت کد جدید کمی صبر کنید."
          : "ارسال پیامک کد ورود انجام نشد. دوباره تلاش کنید.",
    };
  }
  return {
    status: "challenge",
    challengeId: issued.challengeId,
    identifier: identifier.value,
    developmentCode: issued.developmentCode,
  };
}

export async function verifyCandidateCode(
  _previousState: CandidateVerifyCodeState,
  formData: FormData,
): Promise<CandidateVerifyCodeState> {
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
      .from(candidateAuthChallenges)
      .where(eq(candidateAuthChallenges.id, challengeId))
      .limit(1)
      .for("update");

    if (!challenge) return { error: "درخواست ورود پیدا نشد. دوباره تلاش کنید." } as const;

    const availability = getChallengeAvailability(challenge);
    if (availability === "expired") {
      await transaction
        .update(candidateAuthChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(candidateAuthChallenges.id, challenge.id));
      return { error: "زمان استفاده از کد به پایان رسیده است. کد جدید بگیرید." } as const;
    }
    if (availability === "consumed") {
      return { error: "این کد قبلاً استفاده شده است. کد جدید بگیرید." } as const;
    }
    if (availability === "attempts-exhausted") {
      return { error: "تعداد تلاش‌های مجاز تمام شده است. کد جدید بگیرید." } as const;
    }

    const actualDigest = digestVerificationCode(challenge.id, code, getAuthSecret());
    if (!verificationCodeMatches(challenge.codeDigest, actualDigest)) {
      const attempts = challenge.attempts + 1;
      await transaction
        .update(candidateAuthChallenges)
        .set({ attempts, consumedAt: attempts >= MAX_VERIFICATION_ATTEMPTS ? new Date() : null })
        .where(eq(candidateAuthChallenges.id, challenge.id));

      return {
        error: attempts >= MAX_VERIFICATION_ATTEMPTS
          ? "تعداد تلاش‌های مجاز تمام شده است. کد جدید بگیرید."
          : "کد واردشده صحیح نیست.",
      } as const;
    }

    const accountIdentity = challenge.identifierType === "email"
      ? { email: challenge.identifier }
      : { mobile: challenge.identifier };

    await transaction.insert(candidateAccounts).values(accountIdentity).onConflictDoNothing();

    const [account] = await transaction
      .select({ id: candidateAccounts.id })
      .from(candidateAccounts)
      .where(
        challenge.identifierType === "email"
          ? eq(candidateAccounts.email, challenge.identifier)
          : eq(candidateAccounts.mobile, challenge.identifier),
      )
      .limit(1);

    if (!account) throw new Error("Candidate account could not be resolved");

    const sessionMaterial = createCandidateSessionMaterial(account.id);
    await transaction.insert(candidateSessions).values(sessionMaterial.record);
    await transaction
      .update(candidateAuthChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(candidateAuthChallenges.id, challenge.id));

    return sessionMaterial;
  });

  if ("error" in session) return { status: "error", message: session.error };

  await setCandidateSessionCookie(session.token, session.record.expiresAt);
  redirect("/candidate");
}

export async function logoutCandidate() {
  await destroyCandidateSession();
  redirect("/");
}
