import {
  employmentTypeLabels,
  seniorityLevelLabels,
  workplaceTypeLabels,
} from "@/jobs/validation";
import { JobOpportunityCard } from "./job-opportunity-card";
import { buildRecommendationReasonLabels } from "@/recommendations/policy";
import { SaveJobControl } from "./save-job-control";

interface RecommendedJobCardProps {
  job: {
    id: string;
    title: string;
    companyName: string;
    companyLogoUrl: string | null;
    industryName: string;
    location: string | null;
    workplaceType: keyof typeof workplaceTypeLabels | null;
    employmentType: keyof typeof employmentTypeLabels | null;
    seniorityLevel: keyof typeof seniorityLevelLabels | null;
    publishedAt: Date | null;
    matchedSkills: string[];
    locationMatched: boolean;
    workplaceMatched: boolean;
    employmentMatched: boolean;
    seniorityMatched: boolean;
    resumeCityMatched: boolean;
  };
  savingEnabled?: boolean;
  saved?: boolean;
}

export function RecommendedJobCard({ job, savingEnabled = false, saved = false }: RecommendedJobCardProps) {
  const reasons = buildRecommendationReasonLabels(job);
  return <JobOpportunityCard
    job={job}
    skills={job.matchedSkills}
    skillSummary={job.matchedSkills.length ? "مهارت‌های منطبق" : undefined}
    reasons={reasons}
    footerAction={savingEnabled ? <SaveJobControl jobPostId={job.id} initiallySaved={saved} /> : undefined}
  />;
}
