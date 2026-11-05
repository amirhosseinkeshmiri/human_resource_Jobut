import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentAttempts } from "@/db/schema";
import { confirmPackagePurchasePaidInTransaction } from "@/packages/confirm-purchase";
import {
  evaluateCallbackCandidate,
  type SepCallbackFields,
} from "./policy";
import {
  SepProviderError,
  verifySepTransaction,
  type SepFailureCategory,
} from "./sep/adapter";
import type { SepConfig } from "./sep/config";

export type CallbackResult = "success" | "canceled" | "failed" | "invalid" | "review";

export function isDefinitiveVerificationFailure(category: SepFailureCategory) {
  return category === "provider_rejected";
}

async function markAttemptFailed(
  attemptId: string,
  status: "failed" | "canceled",
  gatewayState: string | null,
  failureCategory: string,
) {
  const now = new Date();
  await db
    .update(paymentAttempts)
    .set({ status, gatewayState, failureCategory, failedAt: now, updatedAt: now })
    .where(and(eq(paymentAttempts.id, attemptId), ne(paymentAttempts.status, "verified")));
}

async function markAttemptForReconciliation(
  attemptId: string,
  gatewayState: string | null,
  failureCategory: string,
) {
  await db
    .update(paymentAttempts)
    .set({
      status: "reconciliation_required",
      gatewayState,
      failureCategory,
      failedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentAttempts.id, attemptId), ne(paymentAttempts.status, "verified")));
}

export async function processSepCallback(
  fields: SepCallbackFields,
  config: SepConfig,
  verifyTransaction: typeof verifySepTransaction = verifySepTransaction,
) {
  if (!fields.resNum) return { result: "invalid" as CallbackResult, purchaseId: null };

  const [attempt] = await db
    .select({
      id: paymentAttempts.id,
      packagePurchaseId: paymentAttempts.packagePurchaseId,
      status: paymentAttempts.status,
      amountRial: paymentAttempts.amountRial,
      failureCategory: paymentAttempts.failureCategory,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.resNum, fields.resNum))
    .limit(1);

  if (!attempt) return { result: "invalid" as CallbackResult, purchaseId: null };
  const candidate = evaluateCallbackCandidate(attempt, fields);
  if (candidate.kind === "already_verified") {
    return {
      result: attempt.failureCategory === "duplicate_settlement" ? "review" : "success" as CallbackResult,
      purchaseId: attempt.packagePurchaseId,
    };
  }
  if (candidate.kind === "non_ok") {
    if (attempt.status === "reconciliation_required") {
      return { result: "review" as CallbackResult, purchaseId: attempt.packagePurchaseId };
    }
    const status = candidate.status;
    await markAttemptFailed(attempt.id, status, fields.state, `callback_${status}`);
    return {
      result: status === "canceled" ? "canceled" as const : "failed" as const,
      purchaseId: attempt.packagePurchaseId,
    };
  }

  if (candidate.kind === "invalid") {
    await markAttemptForReconciliation(attempt.id, fields.state, "callback_uncertain");
    return { result: "review" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }
  const { amount: callbackAmount, refNum } = candidate;

  try {
    await verifyTransaction(config, refNum);
  } catch (error) {
    const category = error instanceof SepProviderError ? error.category : "provider_invalid_response";
    if (isDefinitiveVerificationFailure(category)) {
      await markAttemptFailed(attempt.id, "failed", fields.state, category);
      return { result: "failed" as CallbackResult, purchaseId: attempt.packagePurchaseId };
    }
    await markAttemptForReconciliation(attempt.id, fields.state, category);
    return { result: "review" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }

  try {
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`package-purchase:${attempt.packagePurchaseId}`}, 0))`,
      );
      const [current] = await transaction
        .select({
          id: paymentAttempts.id,
          packagePurchaseId: paymentAttempts.packagePurchaseId,
          status: paymentAttempts.status,
          amountRial: paymentAttempts.amountRial,
          refNum: paymentAttempts.refNum,
        })
        .from(paymentAttempts)
        .where(eq(paymentAttempts.id, attempt.id))
        .limit(1)
        .for("update");

      if (!current || current.amountRial !== callbackAmount) return "invalid" as const;
      if (current.status === "verified") {
        return current.refNum === refNum ? "success" as const : "invalid" as const;
      }

      const [replayed] = await transaction
        .select({ id: paymentAttempts.id })
        .from(paymentAttempts)
        .where(
          and(eq(paymentAttempts.refNum, refNum), ne(paymentAttempts.id, current.id)),
        )
        .limit(1);
      if (replayed) return "invalid" as const;

      const verifiedAt = new Date();
      const allocation = await confirmPackagePurchasePaidInTransaction(
        transaction,
        current.packagePurchaseId,
        verifiedAt,
      );
      const duplicateSettlement = !allocation.allocated;
      await transaction
        .update(paymentAttempts)
        .set({
          status: "verified",
          refNum,
          gatewayState: fields.state,
          failureCategory: duplicateSettlement ? "duplicate_settlement" : null,
          verifiedAt,
          failedAt: null,
          updatedAt: verifiedAt,
        })
        .where(and(eq(paymentAttempts.id, current.id), ne(paymentAttempts.status, "verified")));
      return duplicateSettlement ? "review" as const : "success" as const;
    });
    if (result === "invalid") {
      await markAttemptForReconciliation(
        attempt.id,
        fields.state,
        "reference_or_amount_conflict",
      );
      return { result: "review" as CallbackResult, purchaseId: attempt.packagePurchaseId };
    }
    return { result, purchaseId: attempt.packagePurchaseId };
  } catch {
    await markAttemptForReconciliation(attempt.id, fields.state, "finalization_uncertain").catch(
      () => undefined,
    );
    return { result: "review" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }
}
