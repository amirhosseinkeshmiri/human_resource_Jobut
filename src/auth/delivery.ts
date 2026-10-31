import "server-only";
import type { AuthIdentifier } from "./identifier";
import { sendSmtpOtp } from "./email/smtp";
import { sendMeliPayamakOtp } from "./sms/melipayamak";
import { recordOtpProviderFailure } from "./sms/rate-limit";

export class VerificationDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("verification_delivery_failed");
    this.name = "VerificationDeliveryError";
    this.cause = cause;
  }
}

export function hasDevelopmentDelivery() {
  return process.env.NODE_ENV !== "production";
}

export function resolveVerificationDeliveryMode(
  identifier: AuthIdentifier,
  nodeEnvironment = process.env.NODE_ENV,
  smsProvider = process.env.SMS_PROVIDER,
  emailProvider = process.env.EMAIL_PROVIDER,
) {
  if (nodeEnvironment !== "production") return "development" as const;
  if (identifier.type === "email" && emailProvider === "smtp") {
    return "smtp" as const;
  }
  if (identifier.type === "mobile" && smsProvider === "melipayamak") {
    return "melipayamak" as const;
  }
  return "unavailable" as const;
}

export async function deliverVerificationCode(
  identifier: AuthIdentifier,
  verificationCode: string,
): Promise<{ developmentCode?: string }> {
  const mode = resolveVerificationDeliveryMode(identifier);
  if (mode === "development") {
    return { developmentCode: verificationCode };
  }

  if (mode === "smtp") {
    try {
      await sendSmtpOtp(identifier.value, verificationCode);
      return {};
    } catch (error) {
      try {
        await recordOtpProviderFailure("email");
      } catch (limiterError) {
        throw new VerificationDeliveryError(limiterError);
      }
      throw new VerificationDeliveryError(error);
    }
  }

  if (mode !== "melipayamak") {
    throw new VerificationDeliveryError(new Error("provider_unavailable"));
  }

  try {
    await sendMeliPayamakOtp(identifier.value, verificationCode);
    return {};
  } catch (error) {
    try {
      await recordOtpProviderFailure("sms");
    } catch (limiterError) {
      throw new VerificationDeliveryError(limiterError);
    }
    throw new VerificationDeliveryError(error);
  }
}
