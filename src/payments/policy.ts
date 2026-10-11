export const INITIATION_BODY_LIMIT = 2 * 1024;
export const CALLBACK_BODY_LIMIT = 8 * 1024;
export const ACTIVE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^[1-9][0-9]*$/;

export type PaymentAttemptStatus =
  | "created"
  | "redirect_ready"
  | "verified"
  | "failed"
  | "canceled";

export function tomanToRial(priceToman: number) {
  if (!Number.isSafeInteger(priceToman) || priceToman <= 0) {
    throw new Error("INVALID_PURCHASE_AMOUNT");
  }

  const amount = BigInt(priceToman) * BigInt(10);
  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("INVALID_PURCHASE_AMOUNT");
  }

  return Number(amount);
}

export function parseInitiationInput(value: unknown): { purchaseId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "purchaseId") return null;
  const purchaseId = (value as { purchaseId?: unknown }).purchaseId;
  return typeof purchaseId === "string" && UUID_PATTERN.test(purchaseId)
    ? { purchaseId }
    : null;
}

export function isJsonContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

export function isFormContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ===
    "application/x-www-form-urlencoded";
}

export function isSameOrigin(originHeader: string | null, appOrigin: string) {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === appOrigin;
  } catch {
    return false;
  }
}

export function isRecentActiveAttempt(
  status: PaymentAttemptStatus,
  createdAt: Date,
  now = new Date(),
) {
  return (
    (status === "created" || status === "redirect_ready") &&
    createdAt.getTime() >= now.getTime() - ACTIVE_ATTEMPT_WINDOW_MS
  );
}

export function canTransitionAttempt(from: PaymentAttemptStatus, to: PaymentAttemptStatus) {
  if (from === "verified") return to === "verified";
  return true;
}

export interface SepCallbackFields {
  state: string | null;
  resNum: string | null;
  refNum: string | null;
  amountText: string | null;
}

function boundedValue(form: URLSearchParams, name: string, maxLength: number) {
  const value = form.get(name);
  if (value === null || value.length === 0 || value.length > maxLength) return null;
  return value;
}

export function parseSepCallbackForm(raw: string): SepCallbackFields {
  const form = new URLSearchParams(raw);
  return {
    state: boundedValue(form, "State", 80),
    resNum: boundedValue(form, "ResNum", 80),
    refNum: boundedValue(form, "RefNum", 160),
    amountText: boundedValue(form, "Amount", 20),
  };
}

export function parseCallbackAmount(amountText: string | null) {
  if (!amountText || !DECIMAL_PATTERN.test(amountText)) return null;
  const amount = BigInt(amountText);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(amount);
}

export function callbackFailureStatus(state: string | null) {
  return state === "CanceledByUser" ? "canceled" as const : "failed" as const;
}

export function evaluateCallbackCandidate(
  attempt: { status: PaymentAttemptStatus; amountRial: number },
  fields: SepCallbackFields,
) {
  if (attempt.status === "verified") return { kind: "already_verified" as const };
  if (fields.state !== "OK") {
    return { kind: "non_ok" as const, status: callbackFailureStatus(fields.state) };
  }
  const amount = parseCallbackAmount(fields.amountText);
  if (!fields.refNum || amount === null || amount !== attempt.amountRial) {
    return { kind: "invalid" as const };
  }
  return { kind: "verify" as const, refNum: fields.refNum, amount };
}

export function receiptPath(purchaseId: string, result?: "success" | "canceled" | "failed" | "invalid") {
  const path = `/employer/packages/purchases/${purchaseId}`;
  return result ? `${path}?result=${result}` : path;
}
