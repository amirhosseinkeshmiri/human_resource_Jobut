import { employmentTypeLabels, seniorityLevelLabels, workplaceTypeLabels } from "@/jobs/validation";
import { JobOpportunityCard } from "./job-opportunity-card";
import { SaveJobControl } from "./save-job-control";

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
  saved?: boolean;
  savingEnabled?: boolean;
}

export function PublicJobCard({ job, saved = false, savingEnabled = false }: PublicJobCardProps) {
  return <JobOpportunityCard job={job} skills={job.requiredSkills} footerAction={savingEnabled ? <SaveJobControl jobPostId={job.id} initiallySaved={saved} /> : null} />;
}
