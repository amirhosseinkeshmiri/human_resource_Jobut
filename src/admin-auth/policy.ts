export function canIssueAdminChallenge(adminAccountId: string | null | undefined) {
  return Boolean(adminAccountId);
}

export function paidPurchaseRevenue(status: "pending" | "paid", priceToman: number) {
  return status === "paid" ? priceToman : 0;
}

export const deferredAdminMetrics = [
  "resumeCount",
  "dailyActivityCount",
  "candidateActivityStatus",
] as const;

export const adminDashboardMetricKeys = [
  "totalJobPosts",
  "publishedJobPosts",
  "companies",
  "candidateAccounts",
  "paidPurchaseAmountToman",
  "totalEmployerCredits",
] as const;

export function sumLedgerAmounts(amounts: number[]) {
  return amounts.reduce((total, amount) => total + amount, 0);
}
