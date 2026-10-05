export interface PurchasablePackage {
  id: string;
  name: string;
  jobCredits: number;
  priceToman: number;
  isActive: boolean;
}

export function canInitiatePackagePurchase(jobPackage: PurchasablePackage) {
  return jobPackage.isActive && jobPackage.jobCredits > 0 && jobPackage.priceToman >= 0;
}

export function createPendingPurchaseSnapshot(
  companyId: string,
  jobPackage: PurchasablePackage,
) {
  if (!canInitiatePackagePurchase(jobPackage)) {
    throw new Error("Package is not available for purchase");
  }

  return {
    companyId,
    jobPackageId: jobPackage.id,
    packageName: jobPackage.name,
    jobCredits: jobPackage.jobCredits,
    priceToman: jobPackage.priceToman,
    status: "pending" as const,
  };
}

export function purchaseSuccessDecision(status: "pending" | "paid", hasCreditAllocation: boolean) {
  if (status === "paid" && hasCreditAllocation) return "already-allocated" as const;
  if (status === "pending" && !hasCreditAllocation) return "allocate" as const;
  throw new Error("Purchase and credit allocation state are inconsistent");
}
