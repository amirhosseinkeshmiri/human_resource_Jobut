import "server-only";
import { desc, eq } from "drizzle-orm";
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
