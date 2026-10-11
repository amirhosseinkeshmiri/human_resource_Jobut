import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentAttempts } from "@/db/schema";
import { confirmPackagePurchasePaidInTransaction } from "@/packages/confirm-purchase";
import {
  evaluateCallbackCandidate,
  type SepCallbackFields,
} from "./policy";
import { SepProviderError, verifySepTransaction } from "./sep/adapter";
import type { SepConfig } from "./sep/config";

export type CallbackResult = "success" | "canceled" | "failed" | "invalid";

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

export async function processSepCallback(fields: SepCallbackFields, config: SepConfig) {
  if (!fields.resNum) return { result: "invalid" as CallbackResult, purchaseId: null };

  const [attempt] = await db
    .select({
      id: paymentAttempts.id,
      packagePurchaseId: paymentAttempts.packagePurchaseId,
      status: paymentAttempts.status,
      amountRial: paymentAttempts.amountRial,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.resNum, fields.resNum))
    .limit(1);

  if (!attempt) return { result: "invalid" as CallbackResult, purchaseId: null };
  const candidate = evaluateCallbackCandidate(attempt, fields);
  if (candidate.kind === "already_verified") {
    return { result: "success" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }
  if (candidate.kind === "non_ok") {
    const status = candidate.status;
    await markAttemptFailed(attempt.id, status, fields.state, `callback_${status}`);
    return {
      result: status === "canceled" ? "canceled" as const : "failed" as const,
      purchaseId: attempt.packagePurchaseId,
    };
  }

  if (candidate.kind === "invalid") {
    await markAttemptFailed(attempt.id, "failed", fields.state, "callback_invalid");
    return { result: "invalid" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }
  const { amount: callbackAmount, refNum } = candidate;

  try {
    await verifySepTransaction(config, refNum);
  } catch (error) {
    const category = error instanceof SepProviderError ? error.category : "provider_invalid_response";
    await markAttemptFailed(attempt.id, "failed", fields.state, category);
    return { result: "failed" as CallbackResult, purchaseId: attempt.packagePurchaseId };
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
      await confirmPackagePurchasePaidInTransaction(
        transaction,
        current.packagePurchaseId,
        verifiedAt,
      );
      await transaction
        .update(paymentAttempts)
        .set({
          status: "verified",
          refNum,
          gatewayState: fields.state,
          failureCategory: null,
          verifiedAt,
          failedAt: null,
          updatedAt: verifiedAt,
        })
        .where(and(eq(paymentAttempts.id, current.id), ne(paymentAttempts.status, "verified")));
      return "success" as const;
    });
    if (result === "invalid") {
      await markAttemptFailed(attempt.id, "failed", fields.state, "reference_replay");
    }
    return { result, purchaseId: attempt.packagePurchaseId };
  } catch {
    await markAttemptFailed(attempt.id, "failed", fields.state, "finalization_failed").catch(
      () => undefined,
    );
    return { result: "failed" as CallbackResult, purchaseId: attempt.packagePurchaseId };
  }
}
