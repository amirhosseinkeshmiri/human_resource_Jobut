import {
  employmentTypeLabels,
  seniorityLevelLabels,
  workplaceTypeLabels,
} from "./validation";

export interface JobOpportunityCardData {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  industryName?: string;
  location: string | null;
  workplaceType?: keyof typeof workplaceTypeLabels | null;
  employmentType?: keyof typeof employmentTypeLabels | null;
  seniorityLevel?: keyof typeof seniorityLevelLabels | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  publishedAt?: Date | null;
}

export const JOB_CARD_VISIBLE_SKILLS = 3;

export function getCompanyLogoFallback(companyName: string) {
  return companyName.trim().charAt(0) || "ج";
}

export function getVisibleJobSkills(skills: string[] | null | undefined) {
  const visible = skills?.slice(0, JOB_CARD_VISIBLE_SKILLS) ?? [];
  return { visible, remaining: Math.max((skills?.length ?? 0) - visible.length, 0) };
}

export function buildJobOpportunityPresentation(
  job: JobOpportunityCardData,
  skills: string[] | null | undefined,
  reasons: string[],
) {
  return {
    title: job.title,
    companyName: job.companyName,
    detailHref: `/jobs/${job.id}`,
    metadata: [
      job.location,
      job.workplaceType ? workplaceTypeLabels[job.workplaceType] : null,
      job.employmentType ? employmentTypeLabels[job.employmentType] : null,
      job.seniorityLevel ? seniorityLevelLabels[job.seniorityLevel] : null,
    ].filter((value): value is string => value !== null),
    skills: getVisibleJobSkills(skills),
    reasons,
  };
}
