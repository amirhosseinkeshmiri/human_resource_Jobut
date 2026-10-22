import type {
  employmentTypes,
  seniorityLevels,
  workplaceTypes,
} from "@/jobs/validation";

type WorkplaceType = (typeof workplaceTypes)[number];
type EmploymentType = (typeof employmentTypes)[number];
type SeniorityLevel = (typeof seniorityLevels)[number];

export const RECOMMENDATION_LIMIT = 20;

export interface RecommendationProfile {
  skills: string[];
  city: string;
  preferredLocations: string[];
  preferredWorkplaceTypes: WorkplaceType[];
  preferredEmploymentTypes: EmploymentType[];
  preferredSeniorityLevels: SeniorityLevel[];
}

export interface RecommendationCandidate {
  id: string;
  requiredSkills: string[];
  location: string;
  workplaceType: WorkplaceType;
  employmentType: EmploymentType;
  seniorityLevel: SeniorityLevel;
  publishedAt: Date;
  publiclyEligible: boolean;
  alreadyApplied: boolean;
}

export interface RecommendationReasons {
  matchedSkills: string[];
  locationMatched: boolean;
  workplaceMatched: boolean;
  employmentMatched: boolean;
  seniorityMatched: boolean;
  resumeCityMatched: boolean;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fa-IR");
}

function scoreRecommendation(
  profile: RecommendationProfile,
  job: RecommendationCandidate,
) {
  if (!job.publiclyEligible || job.alreadyApplied || profile.skills.length === 0) return null;

  const skillSet = new Set(profile.skills.map(normalizeText));
  const matchedSkills = job.requiredSkills.filter((skill) => skillSet.has(normalizeText(skill)));
  const normalizedLocation = normalizeText(job.location);
  const locationMatched = profile.preferredLocations.some(
    (location) => normalizeText(location) === normalizedLocation,
  );
  const workplaceMatched = profile.preferredWorkplaceTypes.includes(job.workplaceType);
  const employmentMatched = profile.preferredEmploymentTypes.includes(job.employmentType);
  const seniorityMatched = profile.preferredSeniorityLevels.includes(job.seniorityLevel);
  const resumeCityMatched = profile.preferredLocations.length === 0
    && normalizeText(profile.city) === normalizedLocation;
  const explicitPreferenceMatches = [
    locationMatched,
    workplaceMatched,
    employmentMatched,
    seniorityMatched,
  ].filter(Boolean).length;

  if (matchedSkills.length === 0 && explicitPreferenceMatches < 2) return null;

  return {
    job,
    score: (matchedSkills.length * 10)
      + (locationMatched ? 4 : 0)
      + (workplaceMatched ? 3 : 0)
      + (employmentMatched ? 3 : 0)
      + (seniorityMatched ? 3 : 0)
      + (resumeCityMatched ? 2 : 0),
    reasons: {
      matchedSkills,
      locationMatched,
      workplaceMatched,
      employmentMatched,
      seniorityMatched,
      resumeCityMatched,
    } satisfies RecommendationReasons,
  };
}

export function rankRecommendationCandidates(
  profile: RecommendationProfile,
  jobs: RecommendationCandidate[],
) {
  return jobs
    .map((job) => scoreRecommendation(profile, job))
    .filter((recommendation): recommendation is NonNullable<typeof recommendation> => recommendation !== null)
    .sort((left, right) => right.score - left.score
      || right.reasons.matchedSkills.length - left.reasons.matchedSkills.length
      || right.job.publishedAt.getTime() - left.job.publishedAt.getTime()
      || left.job.id.localeCompare(right.job.id))
    .slice(0, RECOMMENDATION_LIMIT);
}
