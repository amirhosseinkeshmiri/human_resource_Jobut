import "server-only";
import type { AuthIdentifier } from "./identifier";

export function hasDevelopmentDelivery() {
  return process.env.NODE_ENV !== "production";
}

export async function deliverVerificationCode(
  _identifier: AuthIdentifier,
  code: string,
): Promise<{ developmentCode: string }> {
  if (!hasDevelopmentDelivery()) {
    throw new Error("Verification-code delivery is not configured");
  }

  return { developmentCode: code };
}
