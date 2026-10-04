import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const OTP_LENGTH = 6;

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  }

  return secret;
}

export function generateVerificationCode() {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function digestVerificationCode(challengeId: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function verificationCodeMatches(expectedDigest: string, actualDigest: string) {
  const expected = Buffer.from(expectedDigest, "hex");
  const actual = Buffer.from(actualDigest, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function digestSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
