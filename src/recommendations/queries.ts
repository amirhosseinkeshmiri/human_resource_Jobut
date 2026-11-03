import "server-only";
import { and, asc, desc, eq, notExists, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateJobPreferences,
  candidateResumes,
  companies,
  industries,
  jobApplications,
  jobPosts,
} from "@/db/schema";
import { publicJobConditions } from "@/jobs/public-queries";
import {
  deduplicateDisplaySkills,
  normalizeRecommendationText,
  RECOMMENDATION_LIMIT,
  RECOMMENDATION_SCORE_WEIGHTS,
} from "./policy";

function sqlList(values: readonly string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `);
}

function enumMatch(column: SQLWrapper, values: readonly string[]): SQL<boolean> {
  return values.length ? sql<boolean>`${column} in (${sqlList(values)})` : sql<boolean>`false`;
}

function normalizedSqlText(value: SQLWrapper) {
  return sql<string>`lower(btrim(regexp_replace(regexp_replace(translate(normalize(${value}, NFKC), 'يىك', 'ییک'), '[ـً-ٰٟ]', '', 'g'), '[[:space:]‌‍]+', ' ', 'g')))`;
}

export type CandidateRecommendationProfile = NonNullable<Awaited<ReturnType<typeof getCandidateRecommendationProfile>>>;

export type CandidateRecommendationData =
  | { state: "no-resume"; recommendations: [] }
  | { state: "no-skills"; recommendations: [] }
  | { state: "ready"; recommendations: Awaited<ReturnType<typeof queryRecommendations>> };

async function queryRecommendations(
  candidateAccountId: string,
  profile: {
    skills: string[];
    city: string;
    preferredLocations: string[];
    preferredWorkplaceTypes: string[];
    preferredEmploymentTypes: string[];
    preferredSeniorityLevels: string[];
  },
  now: Date,
  limit: number,
) {
  const normalizedSkills = deduplicateDisplaySkills(profile.skills).map(normalizeRecommendationText);
  const normalizedLocations = deduplicateDisplaySkills(profile.preferredLocations).map(normalizeRecommendationText);
  const skillValues = sqlList(normalizedSkills);
  const skillCount = sql<number>`(
    select count(distinct ${normalizedSqlText(sql`required_skill.value`)})::int
    from unnest(${jobPosts.requiredSkills}) as required_skill(value)
    where ${normalizedSqlText(sql`required_skill.value`)} in (${skillValues})
  )`;
  const matchedSkills = sql<string[]>`coalesce((
    select array_agg(matches.display_value order by matches.first_ordinality)
    from (
      select
        (array_agg(required_skill.value order by required_skill.ordinality))[1] as display_value,
        min(required_skill.ordinality) as first_ordinality
      from unnest(${jobPosts.requiredSkills}) with ordinality as required_skill(value, ordinality)
      where ${normalizedSqlText(sql`required_skill.value`)} in (${skillValues})
      group by ${normalizedSqlText(sql`required_skill.value`)}
    ) matches
  ), '{}'::text[])`;
  const locationMatched = normalizedLocations.length
    ? sql<boolean>`${normalizedSqlText(jobPosts.location)} in (${sqlList(normalizedLocations)})`
    : sql<boolean>`false`;
  const workplaceMatched = enumMatch(
    jobPosts.workplaceType,
    profile.preferredWorkplaceTypes,
  );
  const employmentMatched = enumMatch(
    jobPosts.employmentType,
    profile.preferredEmploymentTypes,
  );
  const seniorityMatched = enumMatch(
    jobPosts.seniorityLevel,
    profile.preferredSeniorityLevels,
  );
  const resumeCityMatched = normalizedLocations.length === 0
    ? sql<boolean>`${normalizedSqlText(jobPosts.location)} = ${normalizeRecommendationText(profile.city)}`
    : sql<boolean>`false`;
  const explicitPreferenceMatches = sql<number>`(
    (case when ${locationMatched} then 1 else 0 end)
    + (case when ${workplaceMatched} then 1 else 0 end)
    + (case when ${employmentMatched} then 1 else 0 end)
    + (case when ${seniorityMatched} then 1 else 0 end)
  )`;
  const score = sql<number>`(
    (${skillCount} * ${RECOMMENDATION_SCORE_WEIGHTS.skill})
    + (case when ${locationMatched} then ${RECOMMENDATION_SCORE_WEIGHTS.preferredLocation} else 0 end)
    + (case when ${workplaceMatched} then ${RECOMMENDATION_SCORE_WEIGHTS.preferredWorkplace} else 0 end)
    + (case when ${employmentMatched} then ${RECOMMENDATION_SCORE_WEIGHTS.preferredEmployment} else 0 end)
    + (case when ${seniorityMatched} then ${RECOMMENDATION_SCORE_WEIGHTS.preferredSeniority} else 0 end)
    + (case when ${resumeCityMatched} then ${RECOMMENDATION_SCORE_WEIGHTS.resumeCityFallback} else 0 end)
  )`;
  const candidateAlreadyApplied = db.select({ id: jobApplications.id })
    .from(jobApplications)
    .where(and(
      eq(jobApplications.candidateAccountId, candidateAccountId),
      eq(jobApplications.jobPostId, jobPosts.id),
    ));

  return db.select({
    id: jobPosts.id,
    title: jobPosts.title,
    companyName: companies.name,
    companyLogoUrl: companies.logoUrl,
    industryName: industries.name,
    location: jobPosts.location,
    workplaceType: jobPosts.workplaceType,
    employmentType: jobPosts.employmentType,
    seniorityLevel: jobPosts.seniorityLevel,
    requiredSkills: jobPosts.requiredSkills,
    publishedAt: jobPosts.publishedAt,
    matchedSkills,
    locationMatched,
    workplaceMatched,
    employmentMatched,
    seniorityMatched,
    resumeCityMatched,
  }).from(jobPosts)
    .innerJoin(companies, eq(jobPosts.companyId, companies.id))
    .innerJoin(industries, eq(companies.industryId, industries.id))
    .where(and(
      publicJobConditions(now),
      notExists(candidateAlreadyApplied),
      sql`(${skillCount} >= 1 or ${explicitPreferenceMatches} >= 2)`,
    ))
    .orderBy(desc(score), desc(skillCount), desc(jobPosts.publishedAt), asc(jobPosts.id))
    .limit(Math.max(1, Math.min(limit, RECOMMENDATION_LIMIT)));
}

export async function getCandidateRecommendationProfile(candidateAccountId: string) {
  const [profile] = await db.select({
    firstName: candidateResumes.firstName,
    lastName: candidateResumes.lastName,
    city: candidateResumes.city,
    professionalTitle: candidateResumes.professionalTitle,
    professionalSummary: candidateResumes.professionalSummary,
    skills: candidateResumes.skills,
    linkedinUrl: candidateResumes.linkedinUrl,
    portfolioUrl: candidateResumes.portfolioUrl,
    preferredLocations: candidateJobPreferences.preferredLocations,
    preferredWorkplaceTypes: candidateJobPreferences.preferredWorkplaceTypes,
    preferredEmploymentTypes: candidateJobPreferences.preferredEmploymentTypes,
    preferredSeniorityLevels: candidateJobPreferences.preferredSeniorityLevels,
  }).from(candidateResumes)
    .leftJoin(
      candidateJobPreferences,
      eq(candidateResumes.candidateAccountId, candidateJobPreferences.candidateAccountId),
    )
    .where(eq(candidateResumes.candidateAccountId, candidateAccountId))
    .limit(1);

  if (!profile) return null;
  return {
    ...profile,
    preferredLocations: profile.preferredLocations ?? [],
    preferredWorkplaceTypes: profile.preferredWorkplaceTypes ?? [],
    preferredEmploymentTypes: profile.preferredEmploymentTypes ?? [],
    preferredSeniorityLevels: profile.preferredSeniorityLevels ?? [],
  };
}

export async function getRecommendedJobsForProfile(
  candidateAccountId: string,
  profile: CandidateRecommendationProfile,
  now = new Date(),
  limit = RECOMMENDATION_LIMIT,
) {
  if (profile.skills.length === 0) return [];
  return queryRecommendations(candidateAccountId, profile, now, limit);
}

export async function getCandidateRecommendedJobs(
  candidateAccountId: string,
  now = new Date(),
): Promise<CandidateRecommendationData> {
  const profile = await getCandidateRecommendationProfile(candidateAccountId);

  if (!profile) return { state: "no-resume", recommendations: [] };
  if (profile.skills.length === 0) return { state: "no-skills", recommendations: [] };

  const recommendations = await getRecommendedJobsForProfile(candidateAccountId, profile, now);

  return { state: "ready", recommendations };
}
