import "server-only";

import { randomUUID } from "node:crypto";

export type OtpStage =
  | "account_lookup"
  | "challenge_reserve"
  | "rate_limit"
  | "provider_delivery"
  | "challenge_activate"
  | "challenge_invalidate";

export type OtpProvider = "development" | "smtp" | "melipayamak" | "unavailable";

const PROVIDER_CODES = new Set([
  "configuration",
  "timeout",
  "network",
  "http",
  "response_too_large",
  "invalid_response",
  "authentication",
  "invalid_pattern",
  "insufficient_credit",
  "rejected",
]);
const SMTP_CODES = new Map([
  ["EAUTH", "smtp_authentication"],
  ["ETIMEDOUT", "smtp_timeout"],
  ["ECONNECTION", "smtp_connection"],
  ["ESOCKET", "smtp_socket"],
  ["ETLS", "smtp_tls"],
  ["EDNS", "smtp_dns"],
  ["EENVELOPE", "smtp_envelope"],
  ["EMESSAGE", "smtp_message"],
]);

export function createOtpCorrelationId() {
  return randomUUID();
}

function errorCause(error: unknown) {
  return error instanceof Error && "cause" in error ? error.cause : undefined;
}

function trustedProxyFailure(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object") {
      const candidate = current as { name?: unknown; reason?: unknown; forwardedChainLength?: unknown };
      if (
        candidate.name === "TrustedClientIpError" &&
        typeof candidate.reason === "string" &&
        typeof candidate.forwardedChainLength === "number"
      ) {
        return { reason: candidate.reason, forwardedChainLength: candidate.forwardedChainLength };
      }
      current = errorCause(current);
      continue;
    }
    break;
  }
  return null;
}

export function safeOtpErrorCode(error: unknown): string {
  const proxyFailure = trustedProxyFailure(error);
  if (proxyFailure) return `trusted_client_ip_${proxyFailure.reason}`;
  let current = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object") {
      const candidate = current as { category?: unknown; code?: unknown; name?: unknown; message?: unknown };
      if (typeof candidate.category === "string" && PROVIDER_CODES.has(candidate.category)) {
        return `sms_provider_${candidate.category}`;
      }
      if (typeof candidate.code === "string" && SMTP_CODES.has(candidate.code)) {
        return SMTP_CODES.get(candidate.code)!;
      }
      if (candidate.name === "ChallengeCooldownError") return "challenge_cooldown";
      if (candidate.name === "SmsRateLimitExceededError") return "rate_limit_exceeded";
      if (candidate.name === "OtpProviderCircuitOpenError") return "provider_circuit_open";
      if (candidate.name === "SmsRateLimitUnavailableError") return "rate_limit_unavailable";
      if (candidate.name === "TrustedClientIpError") return "trusted_client_ip_unavailable";
      if (typeof candidate.message === "string") {
        if (/^email_configuration_[a-z_]+$/.test(candidate.message)) return candidate.message;
        if (candidate.message === "email_delivery_rejected") return "smtp_rejected";
        if (candidate.message === "email_invalid_recipient") return "invalid_recipient";
        if (candidate.message === "challenge_activation_failed") return "challenge_activation_failed";
      }
      const cause = errorCause(current);
      if (cause) {
        current = cause;
        continue;
      }
    }
    break;
  }
  return "unexpected_error";
}

export function logOtpFailure(input: {
  correlationId: string;
  stage: OtpStage;
  provider: OtpProvider;
  error: unknown;
  startedAt: number;
}) {
  const proxyFailure = trustedProxyFailure(input.error);
  const classifiedCode = safeOtpErrorCode(input.error);
  const errorCode = classifiedCode === "unexpected_error" &&
      (input.stage === "challenge_reserve" || input.stage === "challenge_invalidate")
    ? "database_failure"
    : classifiedCode;
  console.error(JSON.stringify({
    event: "otp_delivery_failure",
    correlationId: input.correlationId,
    stage: input.stage,
    provider: input.provider,
    errorCode,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    ...(proxyFailure ? { forwardedChainLength: proxyFailure.forwardedChainLength } : {}),
  }));
}

export function logOtpChallengeActivated(input: {
  correlationId: string;
  provider: OtpProvider;
  startedAt: number;
}) {
  console.info(JSON.stringify({
    event: "otp_challenge_activated",
    correlationId: input.correlationId,
    provider: input.provider,
    durationMs: Math.max(0, Date.now() - input.startedAt),
  }));
}
