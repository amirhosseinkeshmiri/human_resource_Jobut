import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";
import { JobOpportunityCard } from "./job-opportunity-card";

interface PublicJobCardProps {
  job: {
    id: string;
    title: string;
    workplaceType: keyof typeof workplaceTypeLabels | null;
    employmentType: keyof typeof employmentTypeLabels | null;
    location: string | null;
    seniorityLevel: keyof typeof seniorityLevelLabels | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryNegotiable: boolean | null;
    requiredSkills: string[] | null;
    publishedAt: Date | null;
    companyName: string;
    companyLogoUrl: string | null;
    industryName: string;
  };
}

export function PublicJobCard({ job }: PublicJobCardProps) {
  return <JobOpportunityCard job={job} skills={job.requiredSkills} />;
}
