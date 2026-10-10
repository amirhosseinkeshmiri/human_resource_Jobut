import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  companyJobCreditTransactions,
  packagePurchases,
} from "@/db/schema";
import {
  ADMIN_SALES_PAGE_SIZE,
  fillSalesBuckets,
  getSalesPageCount,
  getSalesRangeStart,
  salesRanges,
  type CreditSort,
  type PurchaseStatusFilter,
  type SalesRange,
} from "./sales-policy";

interface SalesQueryParams {
  range: SalesRange;
  status: PurchaseStatusFilter;
  page: number;
  creditSort: CreditSort;
}

export async function getAdminSales(params: SalesQueryParams, now = new Date()) {
  const rangeStart = getSalesRangeStart(params.range, now);
  const bucket = salesRanges[params.range].bucket;
  const bucketExpression = bucket === "day"
    ? sql<string>`to_char(date_trunc('day', ${packagePurchases.paidAt} at time zone 'UTC'), 'YYYY-MM-DD')`
    : sql<string>`to_char(date_trunc('month', ${packagePurchases.paidAt} at time zone 'UTC'), 'YYYY-MM')`;
  const purchaseFilter = params.status === "all" ? undefined : eq(packagePurchases.status, params.status);

  const [summaryRows, chartRows, purchaseCountRows] = await Promise.all([
    Promise.all([
      db.select({
        paidAmount: sql<number>`coalesce(sum(${packagePurchases.priceToman}) filter (where ${packagePurchases.status} = 'paid'), 0)`.mapWith(Number),
        paidCount: sql<number>`count(*) filter (where ${packagePurchases.status} = 'paid')`.mapWith(Number),
        pendingCount: sql<number>`count(*) filter (where ${packagePurchases.status} = 'pending')`.mapWith(Number),
      }).from(packagePurchases),
      db.select({
        currentCredits: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(Number),
      }).from(companyJobCreditTransactions),
    ]),
    db.select({
      bucket: bucketExpression,
      amount: sql<number>`sum(${packagePurchases.priceToman})`.mapWith(Number),
    })
      .from(packagePurchases)
      .where(and(
        eq(packagePurchases.status, "paid"),
        isNotNull(packagePurchases.paidAt),
        gte(packagePurchases.paidAt, rangeStart),
      ))
      .groupBy(bucketExpression)
      .orderBy(asc(bucketExpression)),
    db.select({ value: count() }).from(packagePurchases).where(purchaseFilter),
  ]);

  const [[purchaseSummary], [creditSummary]] = summaryRows;
  const pageCount = getSalesPageCount(purchaseCountRows[0].value);
  const page = Math.min(params.page, pageCount);

  const creditStats = db
    .select({
      companyId: companyJobCreditTransactions.companyId,
      balance: sql<number>`sum(${companyJobCreditTransactions.amount})`.mapWith(Number).as("balance"),
    })
    .from(companyJobCreditTransactions)
    .groupBy(companyJobCreditTransactions.companyId)
    .as("credit_stats");
  const paidStats = db
    .select({
      companyId: packagePurchases.companyId,
      amount: sql<number>`sum(${packagePurchases.priceToman})`.mapWith(Number).as("paid_amount"),
    })
    .from(packagePurchases)
    .where(eq(packagePurchases.status, "paid"))
    .groupBy(packagePurchases.companyId)
    .as("paid_stats");
  const companyBalance = sql<number>`coalesce(${creditStats.balance}, 0)`.mapWith(Number);
  const companyPaidAmount = sql<number>`coalesce(${paidStats.amount}, 0)`.mapWith(Number);
  const creditOrder = params.creditSort === "credits_asc"
    ? asc(companyBalance)
    : params.creditSort === "paid_desc"
      ? desc(companyPaidAmount)
      : desc(companyBalance);

  const [purchases, companyCredits] = await Promise.all([
    db.select({
      id: packagePurchases.id,
      companyId: companies.id,
      companyName: companies.name,
      packageName: packagePurchases.packageName,
      jobCredits: packagePurchases.jobCredits,
      priceToman: packagePurchases.priceToman,
      status: packagePurchases.status,
      purchasedAt: packagePurchases.purchasedAt,
      paidAt: packagePurchases.paidAt,
    })
      .from(packagePurchases)
      .innerJoin(companies, eq(packagePurchases.companyId, companies.id))
      .where(purchaseFilter)
      .orderBy(desc(packagePurchases.purchasedAt), desc(packagePurchases.id))
      .limit(ADMIN_SALES_PAGE_SIZE)
      .offset((page - 1) * ADMIN_SALES_PAGE_SIZE),
    db.select({
      companyId: companies.id,
      companyName: companies.name,
      balance: companyBalance,
      paidAmount: companyPaidAmount,
    })
      .from(companies)
      .leftJoin(creditStats, eq(companies.id, creditStats.companyId))
      .leftJoin(paidStats, eq(companies.id, paidStats.companyId))
      .orderBy(creditOrder, asc(companies.name), asc(companies.id))
      .limit(12),
  ]);

  return {
    summary: { ...purchaseSummary, currentCredits: creditSummary.currentCredits },
    buckets: fillSalesBuckets(chartRows, params.range, now),
    purchases,
    purchaseTotal: purchaseCountRows[0].value,
    page,
    pageCount,
    companyCredits,
  };
}
