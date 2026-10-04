import "server-only";
import type { EmployerIdentifier } from "./identifier";

export function hasDevelopmentDelivery() {
  return process.env.NODE_ENV !== "production";
}

export async function deliverVerificationCode(
  _identifier: EmployerIdentifier,
  code: string,
): Promise<{ developmentCode: string }> {
  if (!hasDevelopmentDelivery()) {
    throw new Error("Verification-code delivery is not configured");
  }

  return { developmentCode: code };
}
