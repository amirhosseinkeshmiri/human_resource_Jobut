import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companyJobCreditTransactions, packagePurchases } from "@/db/schema";
import { purchaseSuccessDecision } from "./purchase-policy";

/**
 * Internal domain operation for a future verified payment callback.
 * This is deliberately not a Server Action and is never exposed to browser UI.
 */
export async function confirmPackagePurchasePaid(purchaseId: string) {
  return db.transaction(async (transaction) => {
    const [purchase] = await transaction
      .select({
        id: packagePurchases.id,
        companyId: packagePurchases.companyId,
        jobCredits: packagePurchases.jobCredits,
        status: packagePurchases.status,
      })
      .from(packagePurchases)
      .where(eq(packagePurchases.id, purchaseId))
      .limit(1)
      .for("update");

    if (!purchase) throw new Error("Package purchase was not found");

    const [existingAllocation] = await transaction
      .select({ id: companyJobCreditTransactions.id })
      .from(companyJobCreditTransactions)
      .where(eq(companyJobCreditTransactions.packagePurchaseId, purchase.id))
      .limit(1);

    const decision = purchaseSuccessDecision(purchase.status, Boolean(existingAllocation));
    if (decision === "already-allocated") return { allocated: false } as const;

    const [updatedPurchase] = await transaction
      .update(packagePurchases)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(packagePurchases.id, purchase.id), eq(packagePurchases.status, "pending")))
      .returning({ id: packagePurchases.id });

    if (!updatedPurchase) throw new Error("Package purchase is no longer pending");

    await transaction.insert(companyJobCreditTransactions).values({
      companyId: purchase.companyId,
      packagePurchaseId: purchase.id,
      amount: purchase.jobCredits,
    });

    return { allocated: true } as const;
  });
}
