import { NextResponse } from "next/server";
import { processSepCallback, type CallbackResult } from "@/payments/callback";
import {
  CALLBACK_BODY_LIMIT,
  isFormContentType,
  parseSepCallbackForm,
  receiptPath,
} from "@/payments/policy";
import { loadSepConfig, type SepConfig } from "@/payments/sep/config";

export const runtime = "nodejs";

function redirectResult(
  config: SepConfig,
  result: CallbackResult,
  purchaseId: string | null,
) {
  const path = purchaseId
    ? receiptPath(purchaseId, result)
    : "/employer/packages?payment=invalid";
  return NextResponse.redirect(new URL(path, config.appUrl), {
    status: 303,
    headers: { "cache-control": "no-store, private" },
  });
}

export async function POST(request: Request) {
  let config: SepConfig;
  try {
    config = loadSepConfig();
  } catch {
    return new NextResponse("Payment configuration unavailable", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  if (!isFormContentType(request.headers.get("content-type"))) {
    return redirectResult(config, "invalid", null);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > CALLBACK_BODY_LIMIT) {
    return redirectResult(config, "invalid", null);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return redirectResult(config, "invalid", null);
  }
  if (new TextEncoder().encode(raw).byteLength > CALLBACK_BODY_LIMIT) {
    return redirectResult(config, "invalid", null);
  }

  try {
    const outcome = await processSepCallback(parseSepCallbackForm(raw), config);
    return redirectResult(config, outcome.result, outcome.purchaseId);
  } catch {
    return redirectResult(config, "failed", null);
  }
}
