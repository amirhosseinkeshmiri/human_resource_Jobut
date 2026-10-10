export const ADMIN_SALES_PAGE_SIZE = 20;
export const DEFAULT_SALES_RANGE = "30d" as const;

export const salesRanges = {
  "7d": { days: 7, bucket: "day" },
  "30d": { days: 30, bucket: "day" },
  "90d": { days: 90, bucket: "day" },
  "365d": { days: 365, bucket: "month" },
} as const;

export type SalesRange = keyof typeof salesRanges;
export type PurchaseStatusFilter = "all" | "paid" | "pending";
export type CreditSort = "credits_desc" | "credits_asc" | "paid_desc";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminSalesParams(input: {
  range?: string | string[];
  status?: string | string[];
  page?: string | string[];
  creditSort?: string | string[];
}) {
  const requestedRange = firstValue(input.range);
  const range = requestedRange && requestedRange in salesRanges
    ? requestedRange as SalesRange
    : DEFAULT_SALES_RANGE;
  const requestedStatus = firstValue(input.status);
  const status: PurchaseStatusFilter = requestedStatus === "paid" || requestedStatus === "pending"
    ? requestedStatus
    : "all";
  const parsedPage = Number.parseInt(firstValue(input.page) ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedCreditSort = firstValue(input.creditSort);
  const creditSort: CreditSort = requestedCreditSort === "credits_asc" || requestedCreditSort === "paid_desc"
    ? requestedCreditSort
    : "credits_desc";

  return { range, status, page, creditSort };
}

export function getSalesRangeStart(range: SalesRange, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - salesRanges[range].days + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function getPaidSalesDate(purchase: {
  status: "pending" | "paid";
  paidAt: Date | null;
  purchasedAt: Date;
}) {
  return purchase.status === "paid" ? purchase.paidAt : null;
}

export function paidSalesAmount(status: "pending" | "paid", priceToman: number) {
  return status === "paid" ? priceToman : 0;
}

export function getSalesPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / ADMIN_SALES_PAGE_SIZE));
}

export interface SalesBucket {
  key: string;
  amount: number;
  label: string;
}

function dailyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthlyKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function fillSalesBuckets(
  rows: Array<{ bucket: string; amount: number }>,
  range: SalesRange,
  now = new Date(),
): SalesBucket[] {
  const amountByBucket = new Map(rows.map((row) => [row.bucket, row.amount]));
  const start = getSalesRangeStart(range, now);
  const formatter = new Intl.DateTimeFormat("fa-IR", salesRanges[range].bucket === "day"
    ? { month: "short", day: "numeric", timeZone: "UTC" }
    : { year: "numeric", month: "short", timeZone: "UTC" });
  const result: SalesBucket[] = [];

  if (salesRanges[range].bucket === "day") {
    for (const cursor = new Date(start); cursor <= now; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = dailyKey(cursor);
      result.push({ key, amount: amountByBucket.get(key) ?? 0, label: formatter.format(cursor) });
    }
    return result;
  }

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor <= last) {
    const key = monthlyKey(cursor);
    result.push({ key, amount: amountByBucket.get(key) ?? 0, label: formatter.format(cursor) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

export function formatToman(amount: number) {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}
