import "server-only";
import type { AuthIdentifier } from "./identifier";
import { sendMeliPayamakOtp } from "./sms/melipayamak";

export class VerificationDeliveryError extends Error {
  constructor() {
    super("verification_delivery_failed");
    this.name = "VerificationDeliveryError";
  }
}

export function hasDevelopmentDelivery() {
  return process.env.NODE_ENV !== "production";
}

export function resolveVerificationDeliveryMode(
  identifier: AuthIdentifier,
  nodeEnvironment = process.env.NODE_ENV,
  smsProvider = process.env.SMS_PROVIDER,
) {
  if (nodeEnvironment !== "production") return "development" as const;
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

  if (mode !== "melipayamak") {
    throw new VerificationDeliveryError();
  }

  try {
    await sendMeliPayamakOtp(identifier.value, verificationCode);
    return {};
  } catch {
    throw new VerificationDeliveryError();
  }
}
