import type { CallbackResult } from "./callback";

export function getPaymentResultMessage(input: {
  purchaseStatus: "pending" | "paid";
  hasUnresolvedPaymentAttempt: boolean;
  result?: CallbackResult;
}) {
  if (input.result === "review" || input.hasUnresolvedPaymentAttempt) {
    return "وضعیت پرداخت هنوز نهایی نشده است و در حال بررسی است. برای جلوگیری از پرداخت تکراری، فعلاً پرداخت جدیدی انجام ندهید.";
  }
  if (input.purchaseStatus === "paid") {
    return "پرداخت تأیید شد و اعتبار بسته به حساب شرکت افزوده شد.";
  }
  if (input.result === "canceled") {
    return "پرداخت لغو شد. در صورت تمایل دوباره تلاش کنید.";
  }
  if (input.result === "failed" || input.result === "invalid") {
    return "پرداخت تأیید نشد. می‌توانید دوباره تلاش کنید.";
  }
  return null;
}
