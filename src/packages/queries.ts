import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobPackages, packagePurchases } from "@/db/schema";
import { getRemainingJobCredits } from "@/dashboard/metrics";

export async function getEmployerPackagesPageData(companyId: string) {
  const [availablePackages, purchases, remainingJobCredits] = await Promise.all([
    db
      .select({
        id: jobPackages.id,
        name: jobPackages.name,
        jobCredits: jobPackages.jobCredits,
        priceToman: jobPackages.priceToman,
      })
      .from(jobPackages)
      .where(eq(jobPackages.isActive, true))
      .orderBy(jobPackages.priceToman),
    db
      .select({
        id: packagePurchases.id,
        packageName: packagePurchases.packageName,
        jobCredits: packagePurchases.jobCredits,
        priceToman: packagePurchases.priceToman,
        status: packagePurchases.status,
        purchasedAt: packagePurchases.purchasedAt,
      })
      .from(packagePurchases)
      .where(eq(packagePurchases.companyId, companyId))
      .orderBy(desc(packagePurchases.purchasedAt))
      .limit(20),
    getRemainingJobCredits(companyId),
  ]);

  return { availablePackages, purchases, remainingJobCredits };
}

export async function getCompanyPackagePurchase(companyId: string, purchaseId: string) {
  const [purchase] = await db
    .select({
      id: packagePurchases.id,
      packageName: packagePurchases.packageName,
      jobCredits: packagePurchases.jobCredits,
      priceToman: packagePurchases.priceToman,
      status: packagePurchases.status,
      purchasedAt: packagePurchases.purchasedAt,
      paidAt: packagePurchases.paidAt,
    })
    .from(packagePurchases)
    .where(
      and(eq(packagePurchases.id, purchaseId), eq(packagePurchases.companyId, companyId)),
    )
    .limit(1);

  return purchase ?? null;
}
