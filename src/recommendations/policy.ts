import type {
  employmentTypes,
  seniorityLevels,
  workplaceTypes,
} from "@/jobs/validation";

type WorkplaceType = (typeof workplaceTypes)[number];
type EmploymentType = (typeof employmentTypes)[number];
type SeniorityLevel = (typeof seniorityLevels)[number];

export const RECOMMENDATION_LIMIT = 20;
export const RECOMMENDATION_SCORE_WEIGHTS = {
  skill: 10,
  preferredLocation: 4,
  preferredWorkplace: 3,
  preferredEmployment: 3,
  preferredSeniority: 3,
  resumeCityFallback: 2,
} as const;

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

export function normalizeRecommendationText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u0640\u064b-\u065f\u0670]/g, "")
    .replace(/[\u200c\u200d]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fa-IR");
}

export function deduplicateDisplaySkills(skills: readonly string[]) {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    const normalized = normalizeRecommendationText(skill);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function scoreRecommendation(
  profile: RecommendationProfile,
  job: RecommendationCandidate,
) {
  if (!job.publiclyEligible || job.alreadyApplied || profile.skills.length === 0) return null;

  const skillSet = new Set(profile.skills.map(normalizeRecommendationText));
  const matchedSkills = deduplicateDisplaySkills(job.requiredSkills.filter((skill) => skillSet.has(normalizeRecommendationText(skill))));
  const normalizedLocation = normalizeRecommendationText(job.location);
  const locationMatched = profile.preferredLocations.some(
    (location) => normalizeRecommendationText(location) === normalizedLocation,
  );
  const workplaceMatched = profile.preferredWorkplaceTypes.includes(job.workplaceType);
  const employmentMatched = profile.preferredEmploymentTypes.includes(job.employmentType);
  const seniorityMatched = profile.preferredSeniorityLevels.includes(job.seniorityLevel);
  const resumeCityMatched = profile.preferredLocations.length === 0
    && normalizeRecommendationText(profile.city) === normalizedLocation;
  const explicitPreferenceMatches = [
    locationMatched,
    workplaceMatched,
    employmentMatched,
    seniorityMatched,
  ].filter(Boolean).length;

  if (matchedSkills.length === 0 && explicitPreferenceMatches < 2) return null;

  return {
    job,
    score: (matchedSkills.length * RECOMMENDATION_SCORE_WEIGHTS.skill)
      + (locationMatched ? RECOMMENDATION_SCORE_WEIGHTS.preferredLocation : 0)
      + (workplaceMatched ? RECOMMENDATION_SCORE_WEIGHTS.preferredWorkplace : 0)
      + (employmentMatched ? RECOMMENDATION_SCORE_WEIGHTS.preferredEmployment : 0)
      + (seniorityMatched ? RECOMMENDATION_SCORE_WEIGHTS.preferredSeniority : 0)
      + (resumeCityMatched ? RECOMMENDATION_SCORE_WEIGHTS.resumeCityFallback : 0),
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

export function buildRecommendationReasonLabels(reasons: RecommendationReasons) {
  return [
    reasons.matchedSkills.length ? `مهارت مشترک: ${reasons.matchedSkills.slice(0, 3).join("، ")}` : null,
    reasons.locationMatched ? "شهر موردنظر شما" : null,
    reasons.workplaceMatched ? "نحوه حضور موردنظر شما" : null,
    reasons.employmentMatched ? "نوع همکاری موردنظر شما" : null,
    reasons.seniorityMatched ? "سطح شغلی موردنظر شما" : null,
    reasons.resumeCityMatched ? "هم‌راستا با شهر رزومه" : null,
  ].filter((reason): reason is string => reason !== null);
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
