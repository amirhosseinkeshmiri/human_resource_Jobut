import "server-only";
import { digestSessionToken, generateSessionToken } from "./crypto";

export const EMPLOYER_SESSION_DAYS = 30;

export function createEmployerSessionMaterial(employerAccountId: string, now = new Date()) {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + EMPLOYER_SESSION_DAYS * 24 * 60 * 60 * 1000);

  return {
    token,
    record: {
      employerAccountId,
      tokenDigest: digestSessionToken(token),
      expiresAt,
    },
  };
}
