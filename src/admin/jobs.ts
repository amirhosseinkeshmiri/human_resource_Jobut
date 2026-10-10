import "server-only";
import { and, asc, count, desc, eq, gt, ilike, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, industries, jobPosts } from "@/db/schema";
import {
  ADMIN_JOBS_PAGE_SIZE,
  getAdminJobPageCount,
  isJobId,
  type AdminJobFilter,
  type AdminJobSort,
} from "./jobs-policy";

interface AdminJobsParams {
  query: string;
  status: AdminJobFilter;
  sort: AdminJobSort;
  page: number;
}

function statusCondition(status: AdminJobFilter, now: Date): SQL | undefined {
  switch (status) {
    case "draft": return eq(jobPosts.status, "draft");
    case "closed": return eq(jobPosts.status, "closed");
    case "published_active": return and(
      eq(jobPosts.status, "published"),
      isNotNull(jobPosts.publishedAt),
      isNotNull(jobPosts.expiresAt),
      gt(jobPosts.expiresAt, now),
    );
    case "published_expired": return and(
      eq(jobPosts.status, "published"),
      isNotNull(jobPosts.publishedAt),
      isNotNull(jobPosts.expiresAt),
      lte(jobPosts.expiresAt, now),
    );
    case "all":
    default: return undefined;
  }
}

function sortOrder(sort: AdminJobSort): SQL {
  switch (sort) {
    case "created_asc": return asc(jobPosts.createdAt);
    case "published_desc": return sql`${jobPosts.publishedAt} desc nulls last`;
    case "published_asc": return sql`${jobPosts.publishedAt} asc nulls last`;
    case "expires_asc": return sql`${jobPosts.expiresAt} asc nulls last`;
    case "expires_desc": return sql`${jobPosts.expiresAt} desc nulls last`;
    case "created_desc":
    default: return desc(jobPosts.createdAt);
  }
}

export async function getAdminJobs(params: AdminJobsParams, now = new Date()) {
  const searchCondition = params.query
    ? or(ilike(jobPosts.title, `%${params.query}%`), ilike(companies.name, `%${params.query}%`))
    : undefined;
  const conditions = and(statusCondition(params.status, now), searchCondition);
  const [totalRow] = await db
    .select({ value: count() })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(conditions);
  const pageCount = getAdminJobPageCount(totalRow.value);
  const page = Math.min(params.page, pageCount);

  const items = await db
    .select({
      id: jobPosts.id,
      title: jobPosts.title,
      status: jobPosts.status,
      location: jobPosts.location,
      workplaceType: jobPosts.workplaceType,
      employmentType: jobPosts.employmentType,
      createdAt: jobPosts.createdAt,
      publishedAt: jobPosts.publishedAt,
      expiresAt: jobPosts.expiresAt,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(conditions)
    .orderBy(sortOrder(params.sort), desc(jobPosts.createdAt), asc(jobPosts.id))
    .limit(ADMIN_JOBS_PAGE_SIZE)
    .offset((page - 1) * ADMIN_JOBS_PAGE_SIZE);

  return { items, total: totalRow.value, page, pageCount, now };
}

export async function getAdminJobDetail(jobId: string) {
  if (!isJobId(jobId)) return null;

  const [job] = await db
    .select({
      id: jobPosts.id,
      title: jobPosts.title,
      status: jobPosts.status,
      workplaceType: jobPosts.workplaceType,
      employmentType: jobPosts.employmentType,
      location: jobPosts.location,
      seniorityLevel: jobPosts.seniorityLevel,
      salaryMin: jobPosts.salaryMin,
      salaryMax: jobPosts.salaryMax,
      salaryNegotiable: jobPosts.salaryNegotiable,
      requiredSkills: jobPosts.requiredSkills,
      description: jobPosts.description,
      createdAt: jobPosts.createdAt,
      updatedAt: jobPosts.updatedAt,
      publishedAt: jobPosts.publishedAt,
      expiresAt: jobPosts.expiresAt,
      companyId: companies.id,
      companyName: companies.name,
      industryName: industries.name,
    })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .where(eq(jobPosts.id, jobId))
    .limit(1);

  return job ?? null;
}
