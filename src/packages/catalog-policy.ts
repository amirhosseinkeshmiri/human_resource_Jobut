export interface DisplayablePackage {
  isActive: boolean;
  jobCredits: number;
  priceToman: number;
}

export function canDisplayPublicPackage(jobPackage: DisplayablePackage) {
  return jobPackage.isActive && jobPackage.jobCredits > 0 && jobPackage.priceToman > 0;
}

export function calculateUnitPriceToman(priceToman: number, jobCredits: number) {
  if (!Number.isSafeInteger(priceToman) || priceToman <= 0 || !Number.isSafeInteger(jobCredits) || jobCredits <= 0) {
    throw new Error("INVALID_PACKAGE_PRICE");
  }
  // Public unit prices are rounded to the nearest whole toman.
  return Math.round(priceToman / jobCredits);
}

export function formatToman(amount: number) {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}
