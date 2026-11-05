import "server-only";

import { randomUUID } from "node:crypto";

const EXPECTED_HOSTNAME = "console.melipayamak.com";
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 4_096;
export const MIN_NATIVE_OTP_LENGTH = 6;
export const MAX_NATIVE_OTP_LENGTH = 32;

export type MeliPayamakSendingMode = "native_otp" | "shared_template";

export type SmsProviderFailureCategory =
  | "configuration"
  | "timeout"
  | "network"
  | "http"
  | "response_too_large"
  | "invalid_response"
  | "authentication"
  | "invalid_pattern"
  | "insufficient_credit"
  | "rejected";

export class SmsProviderError extends Error {
  constructor(
    public readonly category: SmsProviderFailureCategory,
    public readonly providerCode?: string,
  ) {
    super(category);
    this.name = "SmsProviderError";
  }
}

interface MeliPayamakBaseConfig {
  endpoint: URL;
  timeoutMs: number;
}

export type MeliPayamakConfig =
  | (MeliPayamakBaseConfig & { mode: "native_otp" })
  | (MeliPayamakBaseConfig & { mode: "shared_template"; bodyId: number });

function loadEndpoint(rawEndpoint: string | undefined, pathPrefix: string) {
  if (!rawEndpoint?.trim()) throw new SmsProviderError("configuration");

  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint.trim());
  } catch {
    throw new SmsProviderError("configuration");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== EXPECTED_HOSTNAME ||
    (endpoint.port !== "" && endpoint.port !== "443") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !endpoint.pathname.startsWith(pathPrefix) ||
    endpoint.pathname === pathPrefix
  ) {
    throw new SmsProviderError("configuration");
  }
  return endpoint;
}

export function loadMeliPayamakConfig(
  environment: Record<string, string | undefined> = process.env,
): MeliPayamakConfig {
  const rawTimeout = environment.SMS_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new SmsProviderError("configuration");
  }
  const mode = environment.MELIPAYAMAK_SENDING_MODE?.trim() || "shared_template";
  if (mode === "native_otp") {
    return {
      mode,
      endpoint: loadEndpoint(environment.MELIPAYAMAK_OTP_ENDPOINT, "/api/send/otp/"),
      timeoutMs,
    };
  }
  if (mode !== "shared_template") throw new SmsProviderError("configuration");

  const endpoint = loadEndpoint(
    environment.MELIPAYAMAK_SHARED_ENDPOINT,
    "/api/send/shared/",
  );
  const rawBodyId = environment.MELIPAYAMAK_BODY_ID?.trim();
  const bodyId = rawBodyId && /^[0-9]+$/.test(rawBodyId) ? Number(rawBodyId) : Number.NaN;
  if (!Number.isSafeInteger(bodyId) || bodyId <= 0) {
    throw new SmsProviderError("configuration");
  }
  return { mode, endpoint, bodyId, timeoutMs };
}

export function toMeliPayamakPhone(canonicalMobile: string) {
  const subscriber = canonicalMobile.match(/^\+98(9\d{9})$/)?.[1];
  if (!subscriber) throw new SmsProviderError("invalid_response");
  return `0${subscriber}`;
}

function rejectionCategory(recId: number): SmsProviderFailureCategory {
  if (recId === 0) return "authentication";
  if (recId === 2) return "insufficient_credit";
  if (recId === -4 || recId === -5) return "invalid_pattern";
  return "rejected";
}

function logProviderAttempt(input: {
  correlationId: string;
  outcome: "accepted" | "rejected" | "failed";
  startedAt: number;
  error?: SmsProviderError;
  sendingMode: MeliPayamakSendingMode;
}) {
  const entry = JSON.stringify({
    event: "sms_provider_attempt",
    correlationId: input.correlationId,
    provider: "melipayamak",
    sendingMode: input.sendingMode,
    outcome: input.outcome,
    ...(input.error ? {
      errorCategory: input.error.category,
      ...(input.error.providerCode ? { providerCode: input.error.providerCode } : {}),
    } : {}),
    durationMs: Math.max(0, Date.now() - input.startedAt),
  });
  if (input.outcome === "accepted") console.info(entry);
  else console.error(entry);
}

async function readBoundedBody(response: Response) {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    throw new SmsProviderError("response_too_large");
  }
  if (!response.body) throw new SmsProviderError("invalid_response");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SmsProviderError("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function sendMeliPayamakOtp(
  canonicalMobile: string,
  locallyGeneratedCode?: string,
  fetchImplementation: typeof fetch = fetch,
  environment: Record<string, string | undefined> = process.env,
  correlationId: string = randomUUID(),
) {
  const startedAt = Date.now();
  let sendingMode: MeliPayamakSendingMode = "shared_template";
  try {
    const config = loadMeliPayamakConfig(environment);
    sendingMode = config.mode;
    if (config.mode === "shared_template" && !/^[0-9]{6}$/.test(locallyGeneratedCode ?? "")) {
      throw new SmsProviderError("configuration");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: Response;
    try {
      response = await fetchImplementation(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config.mode === "native_otp"
          ? { to: toMeliPayamakPhone(canonicalMobile) }
          : {
              bodyId: config.bodyId,
              to: toMeliPayamakPhone(canonicalMobile),
              args: [locallyGeneratedCode],
            }),
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof SmsProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SmsProviderError("timeout");
      }
      throw new SmsProviderError("network");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw new SmsProviderError("http", `http_${response.status}`);
    let rawBody: string;
    try {
      rawBody = await readBoundedBody(response);
    } catch (error) {
      if (error instanceof SmsProviderError) throw error;
      throw new SmsProviderError("network");
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      throw new SmsProviderError("invalid_response");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SmsProviderError("invalid_response");
    }
    const status = (body as { status?: unknown }).status;
    if (typeof status !== "string") {
      throw new SmsProviderError("invalid_response");
    }
    if (status.trim() !== "") {
      const responseRecId = (body as { recId?: unknown }).recId;
      const error = config.mode === "shared_template" &&
          typeof responseRecId === "number" && Number.isSafeInteger(responseRecId)
        ? new SmsProviderError(rejectionCategory(responseRecId), `rec_id_${responseRecId}`)
        : new SmsProviderError("rejected");
      logProviderAttempt({ correlationId, outcome: "rejected", startedAt, error, sendingMode });
      throw error;
    }
    if (config.mode === "native_otp") {
      const code = (body as { code?: unknown }).code;
      const nativeCodePattern = new RegExp(
        `^[0-9]{${MIN_NATIVE_OTP_LENGTH},${MAX_NATIVE_OTP_LENGTH}}$`,
      );
      if (typeof code !== "string" || !nativeCodePattern.test(code)) {
        throw new SmsProviderError("invalid_response");
      }
      logProviderAttempt({ correlationId, outcome: "accepted", startedAt, sendingMode });
      return { verificationCode: code, status };
    }

    const recId = (body as { recId?: unknown }).recId;
    if (typeof recId !== "number" || !Number.isSafeInteger(recId)) {
      throw new SmsProviderError("invalid_response");
    }
    if (recId <= 0) {
      const error = new SmsProviderError(rejectionCategory(recId), `rec_id_${recId}`);
      logProviderAttempt({ correlationId, outcome: "rejected", startedAt, error, sendingMode });
      throw error;
    }
    logProviderAttempt({ correlationId, outcome: "accepted", startedAt, sendingMode });
    return { verificationCode: locallyGeneratedCode!, recId, status };
  } catch (error) {
    const providerError = error instanceof SmsProviderError
      ? error
      : new SmsProviderError("network");
    if (providerError.category !== "authentication" &&
        providerError.category !== "invalid_pattern" &&
        providerError.category !== "insufficient_credit" &&
        providerError.category !== "rejected") {
      logProviderAttempt({
        correlationId,
        outcome: "failed",
        startedAt,
        error: providerError,
        sendingMode,
      });
    }
    throw providerError;
  }
}
