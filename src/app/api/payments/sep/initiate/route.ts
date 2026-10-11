import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentEmployer } from "@/auth/session";
import { getEmployerDashboardCompany } from "@/onboarding/company";
import { PaymentError } from "@/payments/errors";
import { initiateSepPayment } from "@/payments/initiate";
import {
  INITIATION_BODY_LIMIT,
  isJsonContentType,
  isSameOrigin,
  parseInitiationInput,
} from "@/payments/policy";
import { loadSepConfig } from "@/payments/sep/config";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, private" },
  });
}

function errorResponse(code: string, message: string, status: number, requestId: string) {
  return json({ code, message, requestId }, status);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let config;
  try {
    config = loadSepConfig();
  } catch {
    return errorResponse(
      "PAYMENT_CONFIGURATION_ERROR",
      "درگاه پرداخت پیکربندی نشده است.",
      502,
      requestId,
    );
  }

  if (!isSameOrigin(request.headers.get("origin"), config.appUrl.origin)) {
    return errorResponse("INVALID_ORIGIN", "درخواست پرداخت معتبر نیست.", 403, requestId);
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return errorResponse("INVALID_CONTENT_TYPE", "نوع محتوای درخواست معتبر نیست.", 400, requestId);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > INITIATION_BODY_LIMIT) {
    return errorResponse("BODY_TOO_LARGE", "حجم درخواست بیش از حد مجاز است.", 400, requestId);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse("INVALID_BODY", "بدنه درخواست معتبر نیست.", 400, requestId);
  }
  if (new TextEncoder().encode(raw).byteLength > INITIATION_BODY_LIMIT) {
    return errorResponse("BODY_TOO_LARGE", "حجم درخواست بیش از حد مجاز است.", 400, requestId);
  }

  let input;
  try {
    input = parseInitiationInput(JSON.parse(raw) as unknown);
  } catch {
    input = null;
  }
  if (!input) {
    return errorResponse("INVALID_INPUT", "شناسه درخواست خرید معتبر نیست.", 400, requestId);
  }

  try {
    const employer = await getCurrentEmployer();
    if (!employer) {
      return errorResponse("UNAUTHENTICATED", "برای پرداخت وارد حساب کارفرما شوید.", 401, requestId);
    }
    const company = await getEmployerDashboardCompany(employer.id);
    if (!company) {
      return errorResponse("COMPANY_REQUIRED", "پروفایل شرکت کامل نیست.", 403, requestId);
    }
    const result = await initiateSepPayment({
      purchaseId: input.purchaseId,
      companyId: company.id,
      employerMobile: employer.mobile,
      config,
    });
    return json(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return errorResponse(error.code, error.publicMessage, error.status, requestId);
    }
    return errorResponse(
      "PAYMENT_UNAVAILABLE",
      "سرویس پرداخت در دسترس نیست. دوباره تلاش کنید.",
      503,
      requestId,
    );
  }
}
