import "server-only";
import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  companyJobCreditTransactions,
  employerAccounts,
  industries,
  jobPosts,
  packagePurchases,
} from "@/db/schema";
import {
  ADMIN_EMPLOYERS_PAGE_SIZE,
  getPageCount,
  isCompanyId,
  type EmployerListParams,
} from "./employers-policy";

export async function getAdminEmployers(params: EmployerListParams) {
  const jobStats = db
    .select({
      companyId: jobPosts.companyId,
      total: count().as("total_jobs"),
      published: sql<number>`count(*) filter (where ${jobPosts.status} = 'published')`.mapWith(Number).as("published_jobs"),
    })
    .from(jobPosts)
    .groupBy(jobPosts.companyId)
    .as("job_stats");
  const creditStats = db
    .select({
      companyId: companyJobCreditTransactions.companyId,
      balance: sql<number>`sum(${companyJobCreditTransactions.amount})`.mapWith(Number).as("credit_balance"),
    })
    .from(companyJobCreditTransactions)
    .groupBy(companyJobCreditTransactions.companyId)
    .as("credit_stats");
  const paidStats = db
    .select({
      companyId: packagePurchases.companyId,
      total: sql<number>`sum(${packagePurchases.priceToman})`.mapWith(Number).as("paid_total"),
    })
    .from(packagePurchases)
    .where(eq(packagePurchases.status, "paid"))
    .groupBy(packagePurchases.companyId)
    .as("paid_stats");
  const totalJobs = sql<number>`coalesce(${jobStats.total}, 0)`.mapWith(Number);
  const publishedJobs = sql<number>`coalesce(${jobStats.published}, 0)`.mapWith(Number);
  const creditBalance = sql<number>`coalesce(${creditStats.balance}, 0)`.mapWith(Number);
  const paidPurchaseTotal = sql<number>`coalesce(${paidStats.total}, 0)`.mapWith(Number);
  const order = (() => {
    switch (params.sort) {
      case "jobs_asc": return asc(totalJobs);
      case "paid_desc": return desc(paidPurchaseTotal);
      case "paid_asc": return asc(paidPurchaseTotal);
      case "credits_desc": return desc(creditBalance);
      case "credits_asc": return asc(creditBalance);
      case "newest": return desc(companies.createdAt);
      case "jobs_desc":
      default: return desc(totalJobs);
    }
  })();
  const search = params.query
    ? or(ilike(companies.name, `%${params.query}%`), ilike(companies.address, `%${params.query}%`))
    : undefined;

  const [totalRow] = await db.select({ value: count() }).from(companies).where(search);
  const pageCount = getPageCount(totalRow.value);
  const page = Math.min(params.page, pageCount);

  const items = await db
    .select({
      id: companies.id,
      name: companies.name,
      address: companies.address,
      industryName: industries.name,
      logoUrl: companies.logoUrl,
      createdAt: companies.createdAt,
      totalJobs,
      publishedJobs,
      creditBalance,
      paidPurchaseTotal,
    })
    .from(companies)
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .leftJoin(jobStats, eq(companies.id, jobStats.companyId))
    .leftJoin(creditStats, eq(companies.id, creditStats.companyId))
    .leftJoin(paidStats, eq(companies.id, paidStats.companyId))
    .where(search)
    .orderBy(order, desc(companies.createdAt), asc(companies.id))
    .limit(ADMIN_EMPLOYERS_PAGE_SIZE)
    .offset((page - 1) * ADMIN_EMPLOYERS_PAGE_SIZE);

  return { items, page, pageCount, total: totalRow.value };
}

export async function getAdminEmployerDetail(companyId: string) {
  if (!isCompanyId(companyId)) return null;

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      address: companies.address,
      foundingYear: companies.foundingYear,
      logoUrl: companies.logoUrl,
      industryName: industries.name,
      employerEmail: employerAccounts.email,
      employerMobile: employerAccounts.mobile,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .innerJoin(employerAccounts, eq(companies.employerAccountId, employerAccounts.id))
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return null;

  const [[jobs], [purchases], [credits], recentJobs, recentPurchases, recentCredits] = await Promise.all([
    db.select({
      total: count(),
      draft: sql<number>`count(*) filter (where ${jobPosts.status} = 'draft')`.mapWith(Number),
      published: sql<number>`count(*) filter (where ${jobPosts.status} = 'published')`.mapWith(Number),
      closed: sql<number>`count(*) filter (where ${jobPosts.status} = 'closed')`.mapWith(Number),
    }).from(jobPosts).where(eq(jobPosts.companyId, companyId)),
    db.select({
      paidAmount: sql<number>`coalesce(sum(${packagePurchases.priceToman}) filter (where ${packagePurchases.status} = 'paid'), 0)`.mapWith(Number),
      paidCount: sql<number>`count(*) filter (where ${packagePurchases.status} = 'paid')`.mapWith(Number),
      pendingCount: sql<number>`count(*) filter (where ${packagePurchases.status} = 'pending')`.mapWith(Number),
    }).from(packagePurchases).where(eq(packagePurchases.companyId, companyId)),
    db.select({
      balance: sql<number>`coalesce(sum(${companyJobCreditTransactions.amount}), 0)`.mapWith(Number),
    }).from(companyJobCreditTransactions).where(eq(companyJobCreditTransactions.companyId, companyId)),
    db.select({ id: jobPosts.id, title: jobPosts.title, status: jobPosts.status, createdAt: jobPosts.createdAt })
      .from(jobPosts).where(eq(jobPosts.companyId, companyId)).orderBy(desc(jobPosts.createdAt)).limit(8),
    db.select({
      id: packagePurchases.id,
      packageName: packagePurchases.packageName,
      jobCredits: packagePurchases.jobCredits,
      priceToman: packagePurchases.priceToman,
      status: packagePurchases.status,
      purchasedAt: packagePurchases.purchasedAt,
    }).from(packagePurchases).where(eq(packagePurchases.companyId, companyId)).orderBy(desc(packagePurchases.purchasedAt)).limit(8),
    db.select({ id: companyJobCreditTransactions.id, amount: companyJobCreditTransactions.amount, createdAt: companyJobCreditTransactions.createdAt })
      .from(companyJobCreditTransactions).where(eq(companyJobCreditTransactions.companyId, companyId)).orderBy(desc(companyJobCreditTransactions.createdAt)).limit(8),
  ]);

  return { company, jobs, purchases, credits, recentJobs, recentPurchases, recentCredits };
}
