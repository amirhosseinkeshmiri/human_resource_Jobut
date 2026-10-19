import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { VERIFICATION_CODE_TTL_MINUTES } from "./challenge-policy";
import { digestVerificationCode, generateVerificationCode, getAuthSecret } from "./crypto";
import { deliverVerificationCode } from "./delivery";
import type { AuthIdentifier } from "./identifier";

export const VERIFICATION_CODE_RESEND_COOLDOWN_SECONDS = 60;

export function isWithinVerificationCodeCooldown(createdAt: Date, now = new Date()) {
  return createdAt.getTime() >
    now.getTime() - VERIFICATION_CODE_RESEND_COOLDOWN_SECONDS * 1000;
}

export class ChallengeCooldownError extends Error {
  constructor() {
    super("challenge_cooldown");
    this.name = "ChallengeCooldownError";
  }
}

interface IssueChallengeCallbacks {
  reserve(input: {
    id: string;
    pendingDigest: string;
    pendingExpiresAt: Date;
  }): Promise<void>;
  activate(input: { id: string; codeDigest: string; expiresAt: Date }): Promise<boolean>;
  invalidate(id: string): Promise<void>;
}

export async function issueVerificationChallenge(
  identifier: AuthIdentifier,
  callbacks: IssueChallengeCallbacks,
  deliver: typeof deliverVerificationCode = deliverVerificationCode,
) {
  const id = randomUUID();
  const secret = getAuthSecret();
  const pendingDigest = digestVerificationCode(
    id,
    `pending:${randomBytes(32).toString("hex")}`,
    secret,
  );
  await callbacks.reserve({ id, pendingDigest, pendingExpiresAt: new Date(0) });

  const verificationCode = generateVerificationCode();
  try {
    const delivery = await deliver(identifier, verificationCode);
    const codeDigest = digestVerificationCode(id, verificationCode, secret);
    const activated = await callbacks.activate({
      id,
      codeDigest,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000),
    });
    if (!activated) throw new Error("challenge_activation_failed");
    return { challengeId: id, developmentCode: delivery.developmentCode };
  } catch {
    await callbacks.invalidate(id).catch(() => undefined);
    throw new Error("verification_delivery_failed");
  }
}
