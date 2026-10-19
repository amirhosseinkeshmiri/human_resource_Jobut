import "server-only";

const EXPECTED_HOSTNAME = "console.melipayamak.com";
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 4_096;

export type SmsProviderFailureCategory =
  | "configuration"
  | "timeout"
  | "network"
  | "http"
  | "response_too_large"
  | "invalid_response";

export class SmsProviderError extends Error {
  constructor(public readonly category: SmsProviderFailureCategory) {
    super(category);
    this.name = "SmsProviderError";
  }
}

export interface MeliPayamakConfig {
  endpoint: URL;
  sender: string;
  timeoutMs: number;
}

export function loadMeliPayamakConfig(
  environment: Record<string, string | undefined> = process.env,
): MeliPayamakConfig {
  const rawEndpoint = environment.MELIPAYAMAK_SIMPLE_ENDPOINT?.trim();
  if (!rawEndpoint) throw new SmsProviderError("configuration");

  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
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
    endpoint.hash
  ) {
    throw new SmsProviderError("configuration");
  }

  const sender = environment.MELIPAYAMAK_FROM?.trim();
  if (!sender || !/^[0-9]{3,32}$/.test(sender)) {
    throw new SmsProviderError("configuration");
  }

  const rawTimeout = environment.SMS_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new SmsProviderError("configuration");
  }
  return { endpoint, sender, timeoutMs };
}

export function toMeliPayamakPhone(canonicalMobile: string) {
  const subscriber = canonicalMobile.match(/^\+98(9\d{9})$/)?.[1];
  if (!subscriber) throw new SmsProviderError("invalid_response");
  return `0${subscriber}`;
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
  verificationCode: string,
  fetchImplementation: typeof fetch = fetch,
  environment: Record<string, string | undefined> = process.env,
) {
  const config = loadMeliPayamakConfig(environment);
  if (!/^[0-9]{6}$/.test(verificationCode)) {
    throw new SmsProviderError("configuration");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImplementation(config.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: config.sender,
        to: toMeliPayamakPhone(canonicalMobile),
        text: `کد ورود به JOBUT: ${verificationCode}`,
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

  if (!response.ok) throw new SmsProviderError("http");
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
  const { recId, status } = body as { recId?: unknown; status?: unknown };
  if (typeof recId !== "number" || !Number.isFinite(recId) || typeof status !== "string") {
    throw new SmsProviderError("invalid_response");
  }
  return { recId, status };
}
