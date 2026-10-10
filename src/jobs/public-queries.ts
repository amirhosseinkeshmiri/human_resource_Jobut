import "server-only";
import { cache } from "react";
import { and, desc, eq, gt, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, industries, jobPosts } from "@/db/schema";

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

export async function getPublicJobs(now = new Date()) {
  return db
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
    .where(publicJobConditions(now))
    .orderBy(desc(jobPosts.publishedAt))
    .limit(50);
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
