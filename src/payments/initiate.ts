import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { packagePurchases, paymentAttempts } from "@/db/schema";
import { PaymentError } from "./errors";
import { isRecentActiveAttempt, receiptPath, tomanToRial } from "./policy";
import { buildSepRedirectUrl, requestSepToken, SepProviderError } from "./sep/adapter";
import type { SepConfig } from "./sep/config";

interface InitiateSepPaymentInput {
  purchaseId: string;
  companyId: string;
  employerMobile: string | null;
  config: SepConfig;
}

export async function initiateSepPayment(input: InitiateSepPaymentInput) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const attemptId = randomUUID();

  const prepared = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`package-purchase:${input.purchaseId}`}, 0))`,
    );

    const [purchase] = await transaction
      .select({
        id: packagePurchases.id,
        status: packagePurchases.status,
        priceToman: packagePurchases.priceToman,
      })
      .from(packagePurchases)
      .where(
        and(
          eq(packagePurchases.id, input.purchaseId),
          eq(packagePurchases.companyId, input.companyId),
        ),
      )
      .limit(1)
      .for("update");

    if (!purchase) {
      throw new PaymentError("PURCHASE_NOT_FOUND", "درخواست خرید پیدا نشد.", 404);
    }
    if (purchase.status === "paid") {
      return { kind: "paid" as const, purchaseId: purchase.id };
    }
    if (purchase.status !== "pending") {
      throw new PaymentError("PURCHASE_NOT_PAYABLE", "این درخواست قابل پرداخت نیست.", 409);
    }

    let amountRial: number;
    try {
      amountRial = tomanToRial(purchase.priceToman);
    } catch {
      throw new PaymentError(
        "INVALID_PURCHASE_AMOUNT",
        "مبلغ این درخواست خرید معتبر نیست.",
        409,
      );
    }

    const [activeAttempt] = await transaction
      .select({ status: paymentAttempts.status, createdAt: paymentAttempts.createdAt })
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.packagePurchaseId, purchase.id),
          inArray(paymentAttempts.status, ["created", "redirect_ready"]),
          gte(paymentAttempts.createdAt, cutoff),
        ),
      )
      .limit(1);

    if (
      activeAttempt &&
      isRecentActiveAttempt(activeAttempt.status, activeAttempt.createdAt, now)
    ) {
      throw new PaymentError(
        "ACTIVE_ATTEMPT_EXISTS",
        "یک تلاش پرداخت فعال است. چند دقیقه دیگر دوباره تلاش کنید.",
        409,
      );
    }

    await transaction.insert(paymentAttempts).values({
      id: attemptId,
      packagePurchaseId: purchase.id,
      amountRial,
      resNum: attemptId,
      status: "created",
      provider: "SEP",
    });

    return { kind: "created" as const, attemptId, amountRial };
  });

  if (prepared.kind === "paid") {
    return {
      receiptUrl: new URL(receiptPath(prepared.purchaseId), input.config.appUrl).toString(),
    };
  }

  try {
    const token = await requestSepToken(input.config, {
      amountRial: prepared.amountRial,
      resNum: prepared.attemptId,
      mobile: input.employerMobile,
    });
    const redirectUrl = buildSepRedirectUrl(token);
    const [updated] = await db
      .update(paymentAttempts)
      .set({ status: "redirect_ready", updatedAt: new Date() })
      .where(
        and(
          eq(paymentAttempts.id, prepared.attemptId),
          eq(paymentAttempts.status, "created"),
        ),
      )
      .returning({ id: paymentAttempts.id });
    if (!updated) throw new PaymentError("ATTEMPT_STATE_CHANGED", "وضعیت پرداخت تغییر کرده است.", 409);
    return { redirectUrl };
  } catch (error) {
    const category =
      error instanceof SepProviderError ? error.category : "provider_invalid_response";
    await db
      .update(paymentAttempts)
      .set({
        status: "failed",
        failureCategory: category,
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentAttempts.id, prepared.attemptId),
          eq(paymentAttempts.status, "created"),
        ),
      )
      .catch(() => undefined);

    if (error instanceof PaymentError) throw error;
    throw new PaymentError(
      "SEP_UNAVAILABLE",
      "اتصال به درگاه پرداخت برقرار نشد. دوباره تلاش کنید.",
      502,
    );
  }
}
