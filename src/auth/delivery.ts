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
  developmentCode: string | null,
): Promise<{ code: string; developmentCode?: string }> {
  const mode = resolveVerificationDeliveryMode(identifier);
  if (mode === "development") {
    if (!developmentCode) throw new VerificationDeliveryError();
    return { code: developmentCode, developmentCode };
  }

  if (mode !== "melipayamak") {
    throw new VerificationDeliveryError();
  }

  try {
    return { code: await sendMeliPayamakOtp(identifier.value) };
  } catch {
    throw new VerificationDeliveryError();
  }
}
