import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobPackages } from "@/db/schema";
export { calculateUnitPriceToman, formatToman } from "./catalog-policy";

export interface PublicPackageCatalogItem {
  id: string;
  name: string;
  jobCredits: number;
  priceToman: number;
  displayValidityText: string | null;
  paymentDescription: string | null;
  onlineCheckoutEnabled: boolean;
}

export async function getPublicPackageCatalog(): Promise<PublicPackageCatalogItem[]> {
  return db.select({
    id: jobPackages.id,
    name: jobPackages.name,
    jobCredits: jobPackages.jobCredits,
    priceToman: jobPackages.priceToman,
    displayValidityText: jobPackages.displayValidityText,
    paymentDescription: jobPackages.paymentDescription,
    onlineCheckoutEnabled: jobPackages.onlineCheckoutEnabled,
  }).from(jobPackages)
    .where(and(
      eq(jobPackages.isActive, true),
      gt(jobPackages.jobCredits, 0),
      gt(jobPackages.priceToman, 0),
    ))
    .orderBy(
      sql`${jobPackages.displayOrder} asc nulls last`,
      asc(jobPackages.priceToman),
      asc(jobPackages.id),
    );
}
