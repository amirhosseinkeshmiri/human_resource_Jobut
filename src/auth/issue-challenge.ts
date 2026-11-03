import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { VERIFICATION_CODE_TTL_MINUTES } from "./challenge-policy";
import { digestVerificationCode, generateVerificationCode, getAuthSecret } from "./crypto";
import { deliverVerificationCode, resolveVerificationDeliveryMode } from "./delivery";
import type { AuthIdentifier } from "./identifier";
import {
  createOtpCorrelationId,
  logOtpFailure,
  type OtpProvider,
  type OtpStage,
} from "./otp-diagnostics";

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
  authorize?(): Promise<void>;
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
  diagnosticContext?: { correlationId?: string; provider?: OtpProvider },
) {
  const startedAt = Date.now();
  const correlationId = diagnosticContext?.correlationId ?? createOtpCorrelationId();
  const provider = diagnosticContext?.provider ?? resolveVerificationDeliveryMode(identifier);
  const id = randomUUID();
  const secret = getAuthSecret();
  const pendingDigest = digestVerificationCode(
    id,
    `pending:${randomBytes(32).toString("hex")}`,
    secret,
  );
  const verificationCode = generateVerificationCode();
  let stage: OtpStage = "challenge_reserve";
  let reserved = false;
  try {
    await callbacks.reserve({ id, pendingDigest, pendingExpiresAt: new Date(0) });
    reserved = true;
    stage = "rate_limit";
    await callbacks.authorize?.();
    stage = "provider_delivery";
    const delivery = await deliver(identifier, verificationCode, { correlationId });
    const codeDigest = digestVerificationCode(id, verificationCode, secret);
    stage = "challenge_activate";
    const activated = await callbacks.activate({
      id,
      codeDigest,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000),
    });
    if (!activated) throw new Error("challenge_activation_failed");
    return { challengeId: id, developmentCode: delivery.developmentCode };
  } catch (error) {
    logOtpFailure({ correlationId, stage, provider, error, startedAt });
    if (reserved) {
      await callbacks.invalidate(id).catch((invalidationError) => {
        logOtpFailure({
          correlationId,
          stage: "challenge_invalidate",
          provider,
          error: invalidationError,
          startedAt,
        });
      });
    }
    throw new Error("verification_delivery_failed");
  }
}
