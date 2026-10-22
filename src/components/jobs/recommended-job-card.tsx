import {
  employmentTypeLabels,
  seniorityLevelLabels,
  workplaceTypeLabels,
} from "@/jobs/validation";
import { JobOpportunityCard } from "./job-opportunity-card";

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
}

export function RecommendedJobCard({ job }: RecommendedJobCardProps) {
  const reasons = [
    job.locationMatched ? "محل موردنظر شما" : null,
    job.workplaceMatched ? "نحوه حضور موردنظر شما" : null,
    job.employmentMatched ? "نوع همکاری موردنظر شما" : null,
    job.seniorityMatched ? "سطح شغلی موردنظر شما" : null,
    job.resumeCityMatched ? "هم‌راستا با شهر رزومه شما" : null,
  ].filter((reason): reason is string => reason !== null);
  return <JobOpportunityCard
    job={job}
    skills={job.matchedSkills}
    skillSummary={job.matchedSkills.length ? `${job.matchedSkills.length.toLocaleString("fa-IR")} مهارت مشترک` : undefined}
    reasons={reasons}
  />;
}
