import "server-only";
import { cache } from "react";
import { and, count, desc, eq, gt, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, industries, jobPosts } from "@/db/schema";
import { getPublicJobsOffset, getPublicJobsPageCount, PUBLIC_JOBS_PAGE_SIZE, type PublicJobFilters } from "./public-search";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function publicJobConditions(now: Date): SQL {
  return and(
    eq(jobPosts.status, "published"),
    isNotNull(jobPosts.publishedAt),
    isNotNull(jobPosts.expiresAt),
    gt(jobPosts.expiresAt, now),
    isNotNull(jobPosts.workplaceType),
    isNotNull(jobPosts.employmentType),
    isNotNull(jobPosts.location),
    isNotNull(jobPosts.seniorityLevel),
    isNotNull(jobPosts.salaryNegotiable),
    isNotNull(jobPosts.requiredSkills),
    isNotNull(jobPosts.description),
    sql`btrim(${jobPosts.title}) <> ''`,
    sql`btrim(${jobPosts.location}) <> ''`,
    sql`btrim(regexp_replace(${jobPosts.description}, '<[^>]*>', ' ', 'g')) <> ''`,
    sql`cardinality(${jobPosts.requiredSkills}) between 1 and 10`,
    sql`(${jobPosts.salaryNegotiable} = true or (${jobPosts.salaryNegotiable} = false and ${jobPosts.salaryMin} is not null and ${jobPosts.salaryMax} is not null and ${jobPosts.salaryMax} >= ${jobPosts.salaryMin}))`,
  )!;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function publicJobSearchConditions(filters: PublicJobFilters, now: Date): SQL {
  const keywordPattern = `%${escapeLikePattern(filters.q)}%`;
  return and(
    publicJobConditions(now),
    filters.q ? or(
      sql`${jobPosts.title} ilike ${keywordPattern} escape '\\'`,
      sql`${companies.name} ilike ${keywordPattern} escape '\\'`,
    ) : undefined,
    filters.location ? sql`lower(btrim(${jobPosts.location})) = lower(${filters.location})` : undefined,
    filters.workplace ? eq(jobPosts.workplaceType, filters.workplace) : undefined,
    filters.employment ? eq(jobPosts.employmentType, filters.employment) : undefined,
    filters.seniority ? eq(jobPosts.seniorityLevel, filters.seniority) : undefined,
  )!;
}

export async function getPublicJobs(filters: PublicJobFilters, now = new Date()) {
  const conditions = publicJobSearchConditions(filters, now);
  const [totalRow] = await db
    .select({ value: count() })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .where(conditions);
  const total = totalRow.value;
  const pageCount = getPublicJobsPageCount(total);
  const page = Math.min(filters.page, pageCount);

  const jobs = await db
    .select({
      id: jobPosts.id,
      title: jobPosts.title,
      workplaceType: jobPosts.workplaceType,
      employmentType: jobPosts.employmentType,
      location: jobPosts.location,
      seniorityLevel: jobPosts.seniorityLevel,
      salaryMin: jobPosts.salaryMin,
      salaryMax: jobPosts.salaryMax,
      salaryNegotiable: jobPosts.salaryNegotiable,
      requiredSkills: jobPosts.requiredSkills,
      publishedAt: jobPosts.publishedAt,
      companyName: companies.name,
      companyLogoUrl: companies.logoUrl,
      industryName: industries.name,
    })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .where(conditions)
    .orderBy(desc(jobPosts.publishedAt), desc(jobPosts.id))
    .limit(PUBLIC_JOBS_PAGE_SIZE)
    .offset(getPublicJobsOffset(page));

  return { jobs, total, page, pageCount };
}

export const getPublicJobById = cache(async (jobId: string) => {
  if (!UUID_PATTERN.test(jobId)) return null;

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
      publishedAt: jobPosts.publishedAt,
      expiresAt: jobPosts.expiresAt,
      companyName: companies.name,
      companyLogoUrl: companies.logoUrl,
      industryName: industries.name,
    })
    .from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .where(and(eq(jobPosts.id, jobId), publicJobConditions(new Date())))
    .limit(1);

  return job ?? null;
});
