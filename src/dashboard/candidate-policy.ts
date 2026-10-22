import type { ApplicationStatus } from "@/applications/status-policy";
import type { CandidateRecommendationProfile } from "@/recommendations/queries";
import { isStoredResumeComplete } from "@/resume/policy";

export const CANDIDATE_DASHBOARD_RECENT_APPLICATION_LIMIT = 5;
export const CANDIDATE_DASHBOARD_RECOMMENDATION_LIMIT = 3;

export const CANDIDATE_DASHBOARD_APPLICATION_FIELDS = [
  "id",
  "createdAt",
  "status",
  "jobPostId",
  "jobTitle",
  "companyName",
] as const;

export interface CandidateApplicationMetrics {
  total: number;
  received: number;
  reviewing: number;
  interview: number;
  rejected: number;
  hired: number;
}

export function buildCandidateDashboardProfile(profile: CandidateRecommendationProfile | null) {
  if (!profile) {
    return {
      greetingName: null,
      resumeExists: false,
      resumeComplete: false,
      professionalTitle: null,
      skillCount: 0,
      preferredLocationCount: 0,
      preferredWorkplaceCount: 0,
      preferredEmploymentCount: 0,
      preferredSeniorityCount: 0,
      hasPreferences: false,
      recommendationsUsable: false,
    };
  }

  const preferenceCounts = {
    preferredLocationCount: profile.preferredLocations.length,
    preferredWorkplaceCount: profile.preferredWorkplaceTypes.length,
    preferredEmploymentCount: profile.preferredEmploymentTypes.length,
    preferredSeniorityCount: profile.preferredSeniorityLevels.length,
  };

  return {
    greetingName: profile.firstName,
    resumeExists: true,
    resumeComplete: isStoredResumeComplete({
      firstName: profile.firstName,
      lastName: profile.lastName,
      city: profile.city,
      professionalTitle: profile.professionalTitle,
      professionalSummary: profile.professionalSummary,
      skills: profile.skills,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
      experiences: [],
      educations: [],
      languages: [],
    }),
    professionalTitle: profile.professionalTitle,
    skillCount: profile.skills.length,
    ...preferenceCounts,
    hasPreferences: Object.values(preferenceCounts).some((count) => count > 0),
    recommendationsUsable: profile.skills.length > 0,
  };
}

export function normalizeCandidateApplicationMetrics(
  metrics: CandidateApplicationMetrics,
): CandidateApplicationMetrics {
  return {
    total: Number(metrics.total),
    received: Number(metrics.received),
    reviewing: Number(metrics.reviewing),
    interview: Number(metrics.interview),
    rejected: Number(metrics.rejected),
    hired: Number(metrics.hired),
  };
}

export function countCandidateApplicationStatuses(
  statuses: ApplicationStatus[],
): CandidateApplicationMetrics {
  const counts: CandidateApplicationMetrics = {
    total: statuses.length,
    received: 0,
    reviewing: 0,
    interview: 0,
    rejected: 0,
    hired: 0,
  };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

export function newestCandidateApplications<T extends { createdAt: Date; id: string }>(items: T[]) {
  return [...items]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      || right.id.localeCompare(left.id))
    .slice(0, CANDIDATE_DASHBOARD_RECENT_APPLICATION_LIMIT);
}

export function recommendationPreview<T>(items: T[]) {
  return items.slice(0, CANDIDATE_DASHBOARD_RECOMMENDATION_LIMIT);
}
