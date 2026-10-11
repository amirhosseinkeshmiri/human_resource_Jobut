import "server-only";
import type { SepConfig } from "./config";

const TOKEN_ENDPOINT = "https://sep.shaparak.ir/onlinepg/onlinepg";
const VERIFY_ENDPOINT =
  "https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction";
const REDIRECT_ORIGIN = "https://sep.shaparak.ir";
const REDIRECT_PATH = "/OnlinePG/SendToken";
const PROVIDER_TIMEOUT_MS = 12_000;

export type SepFailureCategory =
  | "provider_timeout"
  | "provider_network"
  | "provider_http"
  | "provider_invalid_response"
  | "provider_rejected";

export class SepProviderError extends Error {
  constructor(public readonly category: SepFailureCategory) {
    super(category);
    this.name = "SepProviderError";
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  fetchImplementation: typeof fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SepProviderError("provider_timeout");
    }
    throw new SepProviderError("provider_network");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new SepProviderError("provider_http");
  try {
    return await response.json() as unknown;
  } catch {
    throw new SepProviderError("provider_invalid_response");
  }
}

export interface SepTokenRequest {
  amountRial: number;
  resNum: string;
  mobile: string | null;
}

export async function requestSepToken(
  config: SepConfig,
  request: SepTokenRequest,
  fetchImplementation: typeof fetch = fetch,
) {
  const payload: Record<string, unknown> = {
    action: "token",
    TerminalId: config.terminalId,
    Amount: request.amountRial,
    ResNum: request.resNum,
    RedirectUrl: config.callbackUrl.toString(),
  };
  if (request.mobile) payload.CellNumber = request.mobile;

  const body = await postJson(TOKEN_ENDPOINT, payload, fetchImplementation);
  if (!body || typeof body !== "object") {
    throw new SepProviderError("provider_invalid_response");
  }
  const token = (body as { token?: unknown }).token;
  if (
    typeof token !== "string" ||
    token.trim().length === 0 ||
    token.length > 2048
  ) {
    throw new SepProviderError("provider_invalid_response");
  }
  return token;
}

export function buildSepRedirectUrl(token: string) {
  if (!token || token.length > 2048) throw new SepProviderError("provider_invalid_response");
  const url = new URL(REDIRECT_PATH, REDIRECT_ORIGIN);
  url.searchParams.set("token", token);
  if (
    url.protocol !== "https:" ||
    url.origin !== REDIRECT_ORIGIN ||
    url.pathname !== REDIRECT_PATH ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new SepProviderError("provider_invalid_response");
  }
  return url.toString();
}

export async function verifySepTransaction(
  config: SepConfig,
  refNum: string,
  fetchImplementation: typeof fetch = fetch,
) {
  const body = await postJson(
    VERIFY_ENDPOINT,
    { RefNum: refNum, TerminalNumber: config.terminalId },
    fetchImplementation,
  );
  if (!body || typeof body !== "object" || !("ResultCode" in body)) {
    throw new SepProviderError("provider_invalid_response");
  }
  const rawResultCode = (body as { ResultCode: unknown }).ResultCode;
  if (
    (typeof rawResultCode !== "string" && typeof rawResultCode !== "number") ||
    (typeof rawResultCode === "string" && rawResultCode.trim().length === 0)
  ) {
    throw new SepProviderError("provider_invalid_response");
  }
  const resultCode = Number(rawResultCode);
  if (!Number.isInteger(resultCode)) throw new SepProviderError("provider_invalid_response");
  if (resultCode !== 0) throw new SepProviderError("provider_rejected");
  return { verified: true as const };
}
