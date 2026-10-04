"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  employerAccounts,
  employerAuthChallenges,
  employerSessions,
} from "@/db/schema";
import {
  MAX_VERIFICATION_ATTEMPTS,
  VERIFICATION_CODE_TTL_MINUTES,
  getChallengeAvailability,
} from "./challenge-policy";
import {
  digestVerificationCode,
  generateVerificationCode,
  getAuthSecret,
  verificationCodeMatches,
} from "./crypto";
import { deliverVerificationCode, hasDevelopmentDelivery } from "./delivery";
import { normalizeEmployerIdentifier, toLatinDigits } from "./identifier";
import {
  destroyEmployerSession,
  setEmployerSessionCookie,
} from "./session";
import { createEmployerSessionMaterial } from "./session-material";

export interface RequestCodeState {
  status: "idle" | "error" | "challenge";
  message?: string;
  challengeId?: string;
  identifier?: string;
  developmentCode?: string;
}

export interface VerifyCodeState {
  status: "idle" | "error";
  message?: string;
}

export async function requestEmployerVerificationCode(
  _previousState: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const rawIdentifier = formData.get("identifier");
  const identifier = normalizeEmployerIdentifier(
    typeof rawIdentifier === "string" ? rawIdentifier : "",
  );

  if (!identifier) {
    return {
      status: "error",
      message: "ایمیل یا شماره موبایل ایرانی معتبر وارد کنید.",
    };
  }

  if (!hasDevelopmentDelivery()) {
    return {
      status: "error",
      message: "ارسال کد ورود هنوز برای محیط اصلی پیکربندی نشده است.",
    };
  }

  const challengeId = randomUUID();
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);
  const codeDigest = digestVerificationCode(challengeId, code, getAuthSecret());

  await db.transaction(async (transaction) => {
    await transaction
      .update(employerAuthChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(employerAuthChallenges.identifier, identifier.value),
          isNull(employerAuthChallenges.consumedAt),
        ),
      );

    await transaction.insert(employerAuthChallenges).values({
      id: challengeId,
      identifier: identifier.value,
      identifierType: identifier.type,
      codeDigest,
      expiresAt,
    });
  });

  const delivery = await deliverVerificationCode(identifier, code);

  return {
    status: "challenge",
    challengeId,
    identifier: identifier.value,
    developmentCode: delivery.developmentCode,
  };
}

export async function verifyEmployerCode(
  _previousState: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const challengeId = formData.get("challengeId");
  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? toLatinDigits(rawCode.trim()) : "";

  if (typeof challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return { status: "error", message: "درخواست ورود معتبر نیست. دوباره تلاش کنید." };
  }

  if (!/^\d{6}$/.test(code)) {
    return { status: "error", message: "کد ورود باید ۶ رقم باشد." };
  }

  const session = await db.transaction(async (transaction) => {
    const [challenge] = await transaction
      .select()
      .from(employerAuthChallenges)
      .where(eq(employerAuthChallenges.id, challengeId))
      .limit(1)
      .for("update");

    if (!challenge) return { error: "درخواست ورود پیدا نشد. دوباره تلاش کنید." } as const;

    const availability = getChallengeAvailability(challenge);
    if (availability === "expired") {
      await transaction
        .update(employerAuthChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(employerAuthChallenges.id, challenge.id));
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
        .update(employerAuthChallenges)
        .set({
          attempts,
          consumedAt: attempts >= MAX_VERIFICATION_ATTEMPTS ? new Date() : null,
        })
        .where(eq(employerAuthChallenges.id, challenge.id));

      return {
        error:
          attempts >= MAX_VERIFICATION_ATTEMPTS
            ? "تعداد تلاش‌های مجاز تمام شده است. کد جدید بگیرید."
            : "کد واردشده صحیح نیست.",
      } as const;
    }

    const accountIdentity =
      challenge.identifierType === "email"
        ? { email: challenge.identifier }
        : { mobile: challenge.identifier };

    await transaction.insert(employerAccounts).values(accountIdentity).onConflictDoNothing();

    const [account] = await transaction
      .select({ id: employerAccounts.id })
      .from(employerAccounts)
      .where(
        challenge.identifierType === "email"
          ? eq(employerAccounts.email, challenge.identifier)
          : eq(employerAccounts.mobile, challenge.identifier),
      )
      .limit(1);

    if (!account) throw new Error("Employer account could not be resolved");

    const sessionMaterial = createEmployerSessionMaterial(account.id);
    await transaction.insert(employerSessions).values(sessionMaterial.record);
    await transaction
      .update(employerAuthChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(employerAuthChallenges.id, challenge.id));

    return sessionMaterial;
  });

  if ("error" in session) return { status: "error", message: session.error };

  await setEmployerSessionCookie(session.token, session.record.expiresAt);
  redirect("/employer");
}

export async function logoutEmployer() {
  await destroyEmployerSession();
  redirect("/");
}
